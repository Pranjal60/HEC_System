#include "../include/resource_manager.h"
#include <algorithm>
#include <iostream>
#include <set>

using namespace std;

namespace Member5 {

ResourceManager::ResourceManager(vector<Ambulance> ambs,
                                  vector<Bed>       bds,
                                  vector<Doctor>    docs,
                                  vector<Emergency> emgs)
    : ambulances(ambs), beds(bds), doctors(docs), emergencies(emgs),
      ambulanceBanker(1)
{
    int availableAmb = 0;
    for (const auto& amb : ambulances)
        if (amb.status == "AVAILABLE") availableAmb++;
    ambulanceBanker.setAvailable({availableAmb});

    map<int, int> bedAvail;
    map<int, int> docAvail;
    set<int>      allHospitals;

    for (const auto& bed : beds)
    {
        allHospitals.insert(bed.hospital_id);
        if (bed.status == "AVAILABLE") bedAvail[bed.hospital_id]++;
    }
    for (const auto& doc : doctors)
    {
        allHospitals.insert(doc.hospital_id);
        if (doc.availability == "AVAILABLE") docAvail[doc.hospital_id]++;
    }

    for (int hid : allHospitals)
    {
        int ba = bedAvail.count(hid) ? bedAvail[hid] : 0;
        int da = docAvail.count(hid) ? docAvail[hid] : 0;
        hospitalBankers.emplace(hid, Banker(2));
        hospitalBankers.at(hid).setAvailable({ba, da});
    }

    for (const auto& e : emergencies)
    {
        int bedNeeded = e.required_bed_type.empty()       ? 0 : 1;
        int docNeeded = e.required_specialization.empty() ? 0 : 1;

        ambulanceBanker.registerProcess(e.emergency_id, {1});

        if (e.hospital_id != -1 && hospitalBankers.count(e.hospital_id))
        {
            int bn = max(bedNeeded, 0);
            int dn = max(docNeeded, 0);
            if (bn == 0 && dn == 0) bn = 1;
            hospitalBankers.at(e.hospital_id).registerProcess(e.emergency_id, {bn, dn});
        }
    }

    cout << "[ResourceManager] Initialized.\n";
    cout << "  Ambulances: "              << ambulances.size()       << "\n";
    cout << "  Beds: "                    << beds.size()             << "\n";
    cout << "  Doctors: "                 << doctors.size()          << "\n";
    cout << "  Emergencies: "             << emergencies.size()      << "\n";
    cout << "  Hospital Bankers created: " << hospitalBankers.size() << "\n";
}

DecisionResult ResourceManager::processRequest(Request req)
{
    lock_guard<mutex> lock(mtx);

    DecisionResult result = validate(req);
    if (result.decision == Decision::REJECTED)
        return result;

    int priority = getEmergencyPriority(req.emergency_id);

    if (!isAvailable(req))
    {
        addToWaitingQueue(req, priority);
        return {Decision::WAITING, "Resource unavailable"};
    }

    if (!bankerSafe(req))
    {
        addToWaitingQueue(req, priority);
        return {Decision::WAITING, "Banker safety check failed (UNSAFE state)"};
    }

    allocate(req);
    return {Decision::APPROVED, "Banker safety check passed"};
}

vector<WaitingRequest> ResourceManager::tickAging()
{
    lock_guard<mutex> lock(mtx);
    starvationHandler.tick();
    return starvationHandler.getQueue();
}

void ResourceManager::releaseResource(int emergency_id, ResourceType type, int resource_id)
{
    lock_guard<mutex> lock(mtx);

    // Handle anonymous release (emergency_id == -1)
    if (emergency_id == -1)
    {
        if (isOwnedByAnyone(type, resource_id))
        {
            cerr << "[ResourceManager] WARNING: resource " << resource_id
                 << " is owned by an emergency - release ignored.\n";
            return;
        }

        if (type == ResourceType::BED)
        {
            for (auto& bed : beds)
            {
                if (bed.bed_id == resource_id && bed.status != "AVAILABLE")
                {
                    bed.status = "AVAILABLE";
                    cout << "[ResourceManager] Bed " << resource_id << " marked AVAILABLE.\n";
                    int hid = bed.hospital_id;
                    if (hospitalBankers.count(hid))
                    {
                        auto av = hospitalBankers.at(hid).getAvailable();
                        av[0]++;
                        hospitalBankers.at(hid).setAvailable(av);
                    }
                    break;
                }
            }
        }
        else if (type == ResourceType::DOCTOR)
        {
            for (auto& doc : doctors)
            {
                if (doc.doctor_id == resource_id && doc.availability != "AVAILABLE")
                {
                    doc.availability = "AVAILABLE";
                    cout << "[ResourceManager] Doctor " << resource_id << " marked AVAILABLE.\n";
                    int hid = doc.hospital_id;
                    if (hospitalBankers.count(hid))
                    {
                        auto av = hospitalBankers.at(hid).getAvailable();
                        av[1]++;
                        hospitalBankers.at(hid).setAvailable(av);
                    }
                    break;
                }
            }
        }
        else if (type == ResourceType::AMBULANCE)
        {
            for (auto& amb : ambulances)
            {
                if (amb.ambulance_id == resource_id && amb.status != "AVAILABLE")
                {
                    amb.status = "AVAILABLE";
                    cout << "[ResourceManager] Ambulance " << resource_id << " marked AVAILABLE.\n";
                    auto av = ambulanceBanker.getAvailable();
                    av[0]++;
                    ambulanceBanker.setAvailable(av);
                    break;
                }
            }
        }
        reconsiderWaitingQueue();
        return;
    }

    if (!ownsResource(emergency_id, type, resource_id))
    {
        cerr << "[ResourceManager] WARNING: E" << emergency_id
             << " does not own resource " << resource_id << " - release ignored.\n";
        return;
    }

    deallocate(emergency_id, type, resource_id);
    reconsiderWaitingQueue();
}

void ResourceManager::cancelEmergency(int emergency_id)
{
    lock_guard<mutex> lock(mtx);

    if (activeAllocations.count(emergency_id))
    {
        vector<pair<ResourceType,int>> allocsCopy = activeAllocations[emergency_id];
        for (const auto& alloc : allocsCopy)
            deallocate(emergency_id, alloc.first, alloc.second);
    }

    starvationHandler.removeEmergency(emergency_id);
    ambulanceBanker.removeProcess(emergency_id);
    for (auto& entry : hospitalBankers)
        entry.second.removeProcess(emergency_id);

    emergencies.erase(
        remove_if(emergencies.begin(), emergencies.end(),
                  [&](const Emergency& e) { return e.emergency_id == emergency_id; }),
        emergencies.end());

    cout << "[ResourceManager] Emergency " << emergency_id << " cancelled and removed.\n";
    reconsiderWaitingQueue();
}

void ResourceManager::printState() const
{
    lock_guard<mutex> lock(mtx);
    cout << "\n========== RESOURCE MANAGER STATE ==========\n";
    cout << "Ambulances:\n";
    for (const auto& amb : ambulances)
        cout << "  A" << amb.ambulance_id << " [" << amb.type << "] " << amb.status << "\n";

    cout << "Beds:\n";
    for (const auto& bed : beds)
        cout << "  B" << bed.bed_id << " [Hospital " << bed.hospital_id
             << ", " << bed.bed_type << "] " << bed.status << "\n";

    cout << "Doctors:\n";
    for (const auto& doc : doctors)
        cout << "  D" << doc.doctor_id << " [Hospital " << doc.hospital_id
             << ", " << doc.specialization << "] " << doc.availability << "\n";

    cout << "Waiting Queue:\n";
    const auto& q = starvationHandler.getQueue();
    if (q.empty())
    {
        cout << "  (empty)\n";
    }
    else
    {
        for (const auto& wreq : q)
        {
            string rt = (wreq.resource_type == ResourceType::AMBULANCE ? "AMB" :
                         wreq.resource_type == ResourceType::BED        ? "BED" : "DOC");
            cout << "  E" << wreq.emergency_id << " -> " << rt << wreq.resource_id
                 << " | basePri=" << wreq.basePriority
                 << ", wait="     << wreq.waiting_time
                 << ", effPri="   << wreq.effectivePriority << "\n";
        }
    }
    cout << "============================================\n";
}

int ResourceManager::getEmergencyPriority(int emergency_id) const
{
    for (const auto& e : emergencies)
        if (e.emergency_id == emergency_id) return e.priority;
    return 0;
}

void ResourceManager::addToWaitingQueue(const Request& req, int priority)
{
    WaitingRequest wreq;
    wreq.emergency_id      = req.emergency_id;
    wreq.resource_type     = req.resource_type;
    wreq.resource_id       = req.resource_id;
    wreq.hospital_id       = req.hospital_id;
    wreq.basePriority      = priority;
    wreq.waiting_time      = 0;
    wreq.effectivePriority = priority;
    starvationHandler.addWaitingRequest(wreq);
}

DecisionResult ResourceManager::validateEmergency(const Request& req) const
{
    for (const auto& e : emergencies)
    {
        if (e.emergency_id == req.emergency_id)
        {
            if (e.status != "ACTIVE")
                return {Decision::REJECTED, "Emergency is not active (status: " + e.status + ")"};
            return {Decision::APPROVED, ""};
        }
    }
    return {Decision::REJECTED, "Emergency not found"};
}

DecisionResult ResourceManager::validateResource(const Request& req) const
{
    if (req.resource_type == ResourceType::AMBULANCE && req.hospital_id != -1)
        return {Decision::REJECTED, "Ambulance request must use hospital_id = -1"};
    if (req.resource_type != ResourceType::AMBULANCE && req.hospital_id == -1)
        return {Decision::REJECTED, "Bed/Doctor request must specify a valid hospital_id"};

    if (req.resource_type == ResourceType::AMBULANCE)
    {
        for (const auto& a : ambulances)
            if (a.ambulance_id == req.resource_id) return {Decision::APPROVED, ""};
    }
    else if (req.resource_type == ResourceType::BED)
    {
        for (const auto& b : beds)
        {
            if (b.bed_id == req.resource_id)
            {
                if (b.hospital_id != req.hospital_id)
                    return {Decision::REJECTED, "Wrong hospital (bed belongs to different hospital)"};
                return {Decision::APPROVED, ""};
            }
        }
    }
    else
    {
        for (const auto& d : doctors)
        {
            if (d.doctor_id == req.resource_id)
            {
                if (d.hospital_id != req.hospital_id)
                    return {Decision::REJECTED, "Wrong hospital (doctor belongs to different hospital)"};
                return {Decision::APPROVED, ""};
            }
        }
    }
    return {Decision::REJECTED, "Resource not found"};
}

DecisionResult ResourceManager::validateRequirements(const Request& req) const
{
    const Emergency* emg = nullptr;
    for (const auto& e : emergencies)
        if (e.emergency_id == req.emergency_id) { emg = &e; break; }

    if (req.resource_type != ResourceType::AMBULANCE &&
        emg->hospital_id != -1 &&
        emg->hospital_id != req.hospital_id)
        return {Decision::REJECTED, "Emergency belongs to a different hospital"};

    if (req.resource_type == ResourceType::BED && !emg->required_bed_type.empty())
    {
        for (const auto& b : beds)
        {
            if (b.bed_id == req.resource_id)
            {
                if (b.bed_type != emg->required_bed_type)
                    return {Decision::REJECTED,
                            "Bed type mismatch (emergency requires " +
                            emg->required_bed_type + ", bed is " + b.bed_type + ")"};
                break;
            }
        }
    }
    else if (req.resource_type == ResourceType::DOCTOR && !emg->required_specialization.empty())
    {
        for (const auto& d : doctors)
        {
            if (d.doctor_id == req.resource_id)
            {
                if (d.specialization != emg->required_specialization)
                    return {Decision::REJECTED,
                            "Doctor specialization mismatch (emergency requires " +
                            emg->required_specialization + ", doctor is " + d.specialization + ")"};
                break;
            }
        }
    }
    return {Decision::APPROVED, ""};
}

DecisionResult ResourceManager::validateNeed(const Request& req) const
{
    if (req.resource_type == ResourceType::AMBULANCE)
    {
        if (ambulanceBanker.hasProcess(req.emergency_id))
        {
            if (1 > ambulanceBanker.getNeed(req.emergency_id)[0])
                return {Decision::REJECTED, "Request exceeds Need (already fully allocated in this domain)"};
        }
    }
    else
    {
        int hid = req.hospital_id;
        if (hospitalBankers.count(hid) &&
            hospitalBankers.at(hid).hasProcess(req.emergency_id))
        {
            int idx = (req.resource_type == ResourceType::BED) ? 0 : 1;
            if (1 > hospitalBankers.at(hid).getNeed(req.emergency_id)[idx])
                return {Decision::REJECTED, "Request exceeds Need (already fully allocated in this domain)"};
        }
    }
    return {Decision::APPROVED, ""};
}

DecisionResult ResourceManager::validate(const Request& req) const
{
    DecisionResult r;
    r = validateEmergency(req);    if (r.decision == Decision::REJECTED) return r;
    r = validateResource(req);     if (r.decision == Decision::REJECTED) return r;
    r = validateRequirements(req); if (r.decision == Decision::REJECTED) return r;
    r = validateNeed(req);         if (r.decision == Decision::REJECTED) return r;
    return {Decision::APPROVED, ""};
}

bool ResourceManager::isAvailable(const Request& req) const
{
    if (req.resource_type == ResourceType::AMBULANCE)
    {
        for (const auto& a : ambulances)
            if (a.ambulance_id == req.resource_id) return a.status == "AVAILABLE";
    }
    else if (req.resource_type == ResourceType::BED)
    {
        for (const auto& b : beds)
            if (b.bed_id == req.resource_id) return b.status == "AVAILABLE";
    }
    else
    {
        for (const auto& d : doctors)
            if (d.doctor_id == req.resource_id) return d.availability == "AVAILABLE";
    }
    return false;
}

bool ResourceManager::bankerSafe(const Request& req) const
{
    if (req.resource_type == ResourceType::AMBULANCE)
        return ambulanceBanker.canGrantRequest(req.emergency_id, {1});

    int hid = req.hospital_id;
    if (!hospitalBankers.count(hid))
    {
        cerr << "[ResourceManager] ERROR: no Banker for hospital " << hid << "\n";
        return false;
    }
    // BED → index 0, DOCTOR → index 1
    vector<int> rv = (req.resource_type == ResourceType::BED) ? vector<int>{1,0}
                                                               : vector<int>{0,1};
    return hospitalBankers.at(hid).canGrantRequest(req.emergency_id, rv);
}

void ResourceManager::allocate(const Request& req)
{
    if (req.resource_type == ResourceType::AMBULANCE)
    {
        for (auto& a : ambulances)
            if (a.ambulance_id == req.resource_id) { a.status = "BUSY"; break; }
        ambulanceBanker.commitAllocation(req.emergency_id, {1});
    }
    else if (req.resource_type == ResourceType::BED)
    {
        for (auto& b : beds)
            if (b.bed_id == req.resource_id) { b.status = "OCCUPIED"; break; }
        hospitalBankers.at(req.hospital_id).commitAllocation(req.emergency_id, {1, 0});
    }
    else
    {
        for (auto& d : doctors)
            if (d.doctor_id == req.resource_id) { d.availability = "BUSY"; break; }
        hospitalBankers.at(req.hospital_id).commitAllocation(req.emergency_id, {0, 1});
    }
    activeAllocations[req.emergency_id].push_back({req.resource_type, req.resource_id});
}

void ResourceManager::deallocate(int emergency_id, ResourceType type, int resource_id)
{
    if (type == ResourceType::AMBULANCE)
    {
        for (auto& a : ambulances)
            if (a.ambulance_id == resource_id) { a.status = "AVAILABLE"; break; }
        ambulanceBanker.undoAllocation(emergency_id, {1});
    }
    else if (type == ResourceType::BED)
    {
        int hid = -1;
        for (auto& b : beds)
            if (b.bed_id == resource_id) { b.status = "AVAILABLE"; hid = b.hospital_id; break; }
        if (hid != -1)
            hospitalBankers.at(hid).undoAllocation(emergency_id, {1, 0});
    }
    else
    {
        int hid = -1;
        for (auto& d : doctors)
            if (d.doctor_id == resource_id) { d.availability = "AVAILABLE"; hid = d.hospital_id; break; }
        if (hid != -1)
            hospitalBankers.at(hid).undoAllocation(emergency_id, {0, 1});
    }

    if (activeAllocations.count(emergency_id))
    {
        auto& allocs = activeAllocations[emergency_id];
        allocs.erase(
            remove_if(allocs.begin(), allocs.end(),
                      [&](const pair<ResourceType,int>& p)
                      { return p.first == type && p.second == resource_id; }),
            allocs.end());
        if (allocs.empty())
            activeAllocations.erase(emergency_id);
    }
}

bool ResourceManager::ownsResource(int emergency_id, ResourceType type, int resource_id) const
{
    auto it = activeAllocations.find(emergency_id);
    if (it == activeAllocations.end()) return false;
    for (const auto& p : it->second)
        if (p.first == type && p.second == resource_id) return true;
    return false;
}

bool ResourceManager::isOwnedByAnyone(ResourceType type, int resource_id) const
{
    for (const auto& entry : activeAllocations)
        for (const auto& p : entry.second)
            if (p.first == type && p.second == resource_id) return true;
    return false;
}

vector<WaitingRequest> ResourceManager::getWaitingQueue() const
{
    lock_guard<mutex> lock(mtx);
    return starvationHandler.getQueue();
}

// Retry waiting requests after any resource release
void ResourceManager::reconsiderWaitingQueue()
{
    bool allocated = true;
    while (allocated)
    {
        allocated = false;
        const vector<WaitingRequest> snapshot = starvationHandler.getQueue();

        for (const auto& wreq : snapshot)
        {
            Request req;
            req.emergency_id  = wreq.emergency_id;
            req.resource_type = wreq.resource_type;
            req.resource_id   = wreq.resource_id;
            req.hospital_id   = wreq.hospital_id;
            req.priority      = wreq.effectivePriority;

            if (isAvailable(req) && bankerSafe(req))
            {
                allocate(req);
                starvationHandler.removeRequest(
                    wreq.emergency_id, wreq.resource_type, wreq.resource_id);
                cout << "[ResourceManager] Waiting request APPROVED after reconsideration: E"
                     << wreq.emergency_id << " -> resource " << wreq.resource_id << "\n";
                allocated = true;
                break;
            }
        }
    }
}

void ResourceManager::ensureHospitalBanker(int hospital_id)
{
    if (!hospitalBankers.count(hospital_id))
    {
        hospitalBankers.emplace(hospital_id, Banker(2));
        hospitalBankers.at(hospital_id).setAvailable({0, 0});
        cout << "[ResourceManager] Created Banker for new hospital " << hospital_id << ".\n";
    }
}

void ResourceManager::addAmbulance(Ambulance amb)
{
    lock_guard<mutex> lock(mtx);

    for (const auto& a : ambulances)
    {
        if (a.ambulance_id == amb.ambulance_id)
        {
            cerr << "[ResourceManager] WARNING: ambulance " << amb.ambulance_id
                 << " already exists - addAmbulance ignored.\n";
            return;
        }
    }

    bool nowAvailable = (amb.status == "AVAILABLE");
    ambulances.push_back(amb);
    if (nowAvailable)
    {
        auto av = ambulanceBanker.getAvailable();
        av[0]++;
        ambulanceBanker.setAvailable(av);
    }
    cout << "[ResourceManager] Ambulance " << amb.ambulance_id << " registered.\n";
}

void ResourceManager::addBed(Bed bed)
{
    lock_guard<mutex> lock(mtx);

    for (const auto& b : beds)
    {
        if (b.bed_id == bed.bed_id)
        {
            cerr << "[ResourceManager] WARNING: bed " << bed.bed_id
                 << " already exists - addBed ignored.\n";
            return;
        }
    }

    ensureHospitalBanker(bed.hospital_id);
    bool nowAvailable = (bed.status == "AVAILABLE");
    beds.push_back(bed);

    if (nowAvailable)
    {
        auto av = hospitalBankers.at(bed.hospital_id).getAvailable();
        av[0]++;
        hospitalBankers.at(bed.hospital_id).setAvailable(av);
    }

    for (const auto& e : emergencies)
    {
        if (e.hospital_id == bed.hospital_id &&
            !hospitalBankers.at(bed.hospital_id).hasProcess(e.emergency_id))
        {
            int bn = e.required_bed_type.empty()       ? 0 : 1;
            int dn = e.required_specialization.empty() ? 0 : 1;
            if (bn == 0 && dn == 0) bn = 1;
            hospitalBankers.at(bed.hospital_id).registerProcess(e.emergency_id, {bn, dn});
        }
    }

    cout << "[ResourceManager] Bed " << bed.bed_id << " registered under hospital "
         << bed.hospital_id << ".\n";
    reconsiderWaitingQueue();
}

void ResourceManager::addDoctor(Doctor doc)
{
    lock_guard<mutex> lock(mtx);

    for (const auto& d : doctors)
    {
        if (d.doctor_id == doc.doctor_id)
        {
            cerr << "[ResourceManager] WARNING: doctor " << doc.doctor_id
                 << " already exists - addDoctor ignored.\n";
            return;
        }
    }

    ensureHospitalBanker(doc.hospital_id);
    bool nowAvailable = (doc.availability == "AVAILABLE");
    doctors.push_back(doc);

    if (nowAvailable)
    {
        auto av = hospitalBankers.at(doc.hospital_id).getAvailable();
        av[1]++;
        hospitalBankers.at(doc.hospital_id).setAvailable(av);
    }

    for (const auto& e : emergencies)
    {
        if (e.hospital_id == doc.hospital_id &&
            !hospitalBankers.at(doc.hospital_id).hasProcess(e.emergency_id))
        {
            int bn = e.required_bed_type.empty()       ? 0 : 1;
            int dn = e.required_specialization.empty() ? 0 : 1;
            if (bn == 0 && dn == 0) bn = 1;
            hospitalBankers.at(doc.hospital_id).registerProcess(e.emergency_id, {bn, dn});
        }
    }

    cout << "[ResourceManager] Doctor " << doc.doctor_id << " registered under hospital "
         << doc.hospital_id << ".\n";
    reconsiderWaitingQueue();
}

void ResourceManager::addEmergency(Emergency emg)
{
    lock_guard<mutex> lock(mtx);

    for (const auto& e : emergencies)
    {
        if (e.emergency_id == emg.emergency_id)
        {
            cerr << "[ResourceManager] WARNING: emergency " << emg.emergency_id
                 << " already exists - addEmergency ignored.\n";
            return;
        }
    }

    emergencies.push_back(emg);
    ambulanceBanker.registerProcess(emg.emergency_id, {1});

    if (emg.hospital_id != -1)
    {
        ensureHospitalBanker(emg.hospital_id);
        int bn = emg.required_bed_type.empty()       ? 0 : 1;
        int dn = emg.required_specialization.empty() ? 0 : 1;
        if (bn == 0 && dn == 0) bn = 1;
        hospitalBankers.at(emg.hospital_id).registerProcess(emg.emergency_id, {bn, dn});
    }

    cout << "[ResourceManager] Emergency " << emg.emergency_id << " registered.\n";
}

void ResourceManager::assignHospital(int emergency_id, int hospital_id)
{
    lock_guard<mutex> lock(mtx);

    Emergency* emg = nullptr;
    for (auto& e : emergencies)
        if (e.emergency_id == emergency_id) { emg = &e; break; }

    if (!emg)
    {
        cerr << "[ResourceManager] WARNING: emergency " << emergency_id
             << " not found - assignHospital ignored.\n";
        return;
    }

    emg->hospital_id = hospital_id;
    ensureHospitalBanker(hospital_id);

    if (!hospitalBankers.at(hospital_id).hasProcess(emergency_id))
    {
        int bn = emg->required_bed_type.empty()       ? 0 : 1;
        int dn = emg->required_specialization.empty() ? 0 : 1;
        if (bn == 0 && dn == 0) bn = 1;
        hospitalBankers.at(hospital_id).registerProcess(emergency_id, {bn, dn});
    }

    cout << "[ResourceManager] Emergency " << emergency_id
         << " assigned to hospital " << hospital_id << ".\n";
}

} // namespace Member5
