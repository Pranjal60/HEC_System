#ifndef RESOURCE_MANAGER_H
#define RESOURCE_MANAGER_H

#include "models.h"
#include "banker.h"
#include "starvation.h"

#include <vector>
#include <map>
#include <mutex>

namespace Member5 {

class ResourceManager
{
public:
    ResourceManager(
        std::vector<Ambulance> ambulances,
        std::vector<Bed>       beds,
        std::vector<Doctor>    doctors,
        std::vector<Emergency> emergencies
    );

    DecisionResult processRequest(Request req);

    void releaseResource(int emergency_id, ResourceType type, int resource_id);
    void cancelEmergency(int emergency_id);

    void printState() const;

    std::vector<WaitingRequest> tickAging();
    std::vector<WaitingRequest> getWaitingQueue() const;

    // Dynamic registration — call these when new rows appear in the DB.
    void addAmbulance(Ambulance amb);
    void addBed(Bed bed); 
    void addDoctor(Doctor doc);
    void addEmergency(Emergency emg);

    // Records which hospital Member 3 assigned to an emergency.
    // Returns false if the emergency is unknown or already assigned elsewhere.
    bool assignHospital(int emergency_id, int hospital_id);

private:
    std::vector<Ambulance> ambulances;
    std::vector<Bed>       beds;
    std::vector<Doctor>    doctors;
    std::vector<Emergency> emergencies;

    std::map<int, std::vector<std::pair<ResourceType, int>>> activeAllocations;

    mutable std::mutex mtx;

    Banker                 ambulanceBanker;
    std::map<int, Banker>  hospitalBankers;

    StarvationHandler starvationHandler;

    // Validation pipeline
    DecisionResult validate(const Request& req) const;
    DecisionResult validateEmergency(const Request& req) const;
    DecisionResult validateResource(const Request& req) const;
    DecisionResult validateRequirements(const Request& req) const;
    DecisionResult validateNeed(const Request& req) const;

    // Availability and safety
    bool isAvailable(const Request& req) const;
    bool bankerSafe(const Request& req) const;

    // Allocation lifecycle
    void allocate(const Request& req);
    void deallocate(int emergency_id, ResourceType type, int resource_id);

    // Utilities
    int  getEmergencyPriority(int emergency_id) const;
    void addToWaitingQueue(const Request& req, int priority);
    bool ownsResource(int emergency_id, ResourceType type, int resource_id) const;
    bool isOwnedByAnyone(ResourceType type, int resource_id) const;
    void reconsiderWaitingQueue();
    void ensureHospitalBanker(int hospital_id);
};

} // namespace Member5

#endif // RESOURCE_MANAGER_H
