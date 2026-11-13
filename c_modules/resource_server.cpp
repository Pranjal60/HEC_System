// resource_server.cpp — JSON stdin/stdout wrapper for Member 5's ResourceManager.
//
// Input:  { "state": { ambulances, beds, doctors, emergencies }, "command": { action, ... } }
// Output: { "decision":"APPROVED"|"WAITING"|"REJECTED", "reason":"..." }
//      or { "ok": true, "message": "..." }
//      or { "error": "..." }
//
// No external JSON library — parses the minimal subset needed via string operations.

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>

#include "include/models.h"
#include "include/resource_manager.h"
#include "include/deadlock.h"
#include "include/starvation.h"
#include "include/synchronization.h"

using namespace std;
using namespace Member5;

// ─── Minimal JSON helpers ──────────────────────────────────────────────────

static string getStringField(const string& json, const string& key) {
    string pattern = "\"" + key + "\"";
    auto pos = json.find(pattern);
    if (pos == string::npos) return "";
    pos = json.find(":", pos + pattern.size());
    if (pos == string::npos) return "";
    pos = json.find("\"", pos + 1);
    if (pos == string::npos) return "";
    auto end = json.find("\"", pos + 1);
    if (end == string::npos) return "";
    return json.substr(pos + 1, end - pos - 1);
}

static int getIntField(const string& json, const string& key, int def = -1) {
    string pattern = "\"" + key + "\"";
    auto pos = json.find(pattern);
    if (pos == string::npos) return def;
    pos = json.find(":", pos + pattern.size());
    if (pos == string::npos) return def;
    while (pos < json.size() && (json[pos+1]==' '||json[pos+1]=='\t'||json[pos+1]=='\n')) pos++;
    try { return stoi(json.substr(pos + 1)); } catch (...) { return def; }
}

// Extract array section as a substring (finds matching brackets)
static string extractArray(const string& json, const string& key) {
    string pattern = "\"" + key + "\"";
    auto pos = json.find(pattern);
    if (pos == string::npos) return "[]";
    pos = json.find("[", pos + pattern.size());
    if (pos == string::npos) return "[]";
    int depth = 0;
    size_t start = pos;
    for (size_t i = pos; i < json.size(); i++) {
        if (json[i] == '[') depth++;
        else if (json[i] == ']') {
            depth--;
            if (depth == 0) return json.substr(start, i - start + 1);
        }
    }
    return "[]";
}

// Split an array string into individual JSON objects
static vector<string> splitObjects(const string& arr) {
    vector<string> result;
    int depth = 0;
    size_t start = string::npos;
    for (size_t i = 0; i < arr.size(); i++) {
        if (arr[i] == '{') {
            if (depth == 0) start = i;
            depth++;
        } else if (arr[i] == '}') {
            depth--;
            if (depth == 0 && start != string::npos) {
                result.push_back(arr.substr(start, i - start + 1));
                start = string::npos;
            }
        }
    }
    return result;
}

// Normalise DB status strings to what ResourceManager expects
static string normaliseStatus(const string& s) {
    // Ambulance: available→AVAILABLE, in_transit→BUSY
    if (s == "available" || s == "Available")    return "AVAILABLE";
    if (s == "in_transit" || s == "Dispatched" || s == "On Trip") return "BUSY";
    if (s == "Occupied")     return "OCCUPIED";
    if (s == "Busy" || s == "not_available" || s == "Not_Available") return "BUSY";
    if (s == "Off Duty")     return "BUSY";
    if (s == "Requested" || s == "Dispatched" || s == "In Transit" ||
        s == "Admitted" || s == "Treatment")  return "ACTIVE";
    if (s == "Discharged" || s == "Cancelled") return "RESOLVED";
    return s;
}

// ─── Main ──────────────────────────────────────────────────────────────────

int main() {
    ostringstream buf;
    buf << cin.rdbuf();
    string input = buf.str();

    if (input.empty()) {
        cout << "{\"error\":\"Empty input\"}" << endl;
        return 1;
    }

    string stateStr, commandStr;
    {
        auto pos = input.find("\"state\"");
        if (pos != string::npos) {
            pos = input.find("{", pos + 7);
            if (pos != string::npos) {
                int d = 0; size_t s2 = pos;
                for (size_t i = pos; i < input.size(); i++) {
                    if (input[i] == '{') d++;
                    else if (input[i] == '}') { d--; if (d==0){ stateStr = input.substr(s2, i-s2+1); break; } }
                }
            }
        }
        auto cpos = input.find("\"command\"");
        if (cpos != string::npos) {
            cpos = input.find("{", cpos + 9);
            if (cpos != string::npos) {
                int d = 0; size_t s2 = cpos;
                for (size_t i = cpos; i < input.size(); i++) {
                    if (input[i] == '{') d++;
                    else if (input[i] == '}') { d--; if (d==0){ commandStr = input.substr(s2, i-s2+1); break; } }
                }
            }
        }
    }

    if (commandStr.empty()) {
        cout << "{\"error\":\"No command found in input\"}" << endl;
        return 1;
    }

    // Parse state arrays
    vector<Ambulance> ambulances;
    {
        string arr = extractArray(stateStr, "ambulances");
        for (auto& obj : splitObjects(arr)) {
            Ambulance a;
            a.ambulance_id    = getIntField(obj, "ambulance_id", 0);
            a.type            = getStringField(obj, "type");
            a.status          = normaliseStatus(getStringField(obj, "status"));
            a.current_location= getStringField(obj, "current_location");
            ambulances.push_back(a);
        }
    }

    vector<Bed> beds;
    {
        string arr = extractArray(stateStr, "beds");
        for (auto& obj : splitObjects(arr)) {
            Bed b;
            b.bed_id     = getIntField(obj, "bed_id", 0);
            b.hospital_id= getIntField(obj, "hospital_id", 0);
            b.bed_type   = getStringField(obj, "bed_type");
            b.status     = normaliseStatus(getStringField(obj, "status"));
            beds.push_back(b);
        }
    }

    vector<Doctor> doctors;
    {
        string arr = extractArray(stateStr, "doctors");
        for (auto& obj : splitObjects(arr)) {
            Doctor d;
            d.doctor_id     = getIntField(obj, "doctor_id", 0);
            d.hospital_id   = getIntField(obj, "hospital_id", 0);
            d.specialization= getStringField(obj, "specialization");
            d.availability  = normaliseStatus(getStringField(obj, "availability"));
            doctors.push_back(d);
        }
    }

    vector<Emergency> emergencies;
    {
        string arr = extractArray(stateStr, "emergencies");
        for (auto& obj : splitObjects(arr)) {
            Emergency e;
            e.emergency_id            = getIntField(obj, "emergency_id", 0);
            e.hospital_id             = getIntField(obj, "hospital_id", -1);
            e.priority                = getIntField(obj, "priority", 1);
            e.status                  = normaliseStatus(getStringField(obj, "status"));
            e.required_bed_type       = "";
            e.required_specialization = "";
            emergencies.push_back(e);
        }
    }

    // Redirect ResourceManager's cout to devNull so stdout stays clean JSON
    auto* origCout = cout.rdbuf();
    ostringstream devNull;
    cout.rdbuf(devNull.rdbuf());

    ResourceManager rm(ambulances, beds, doctors, emergencies);

    cout.rdbuf(origCout);

    // Execute command
    string action = getStringField(commandStr, "action");

    if (action == "processRequest") {
        int eid  = getIntField(commandStr, "emergency_id", 0);
        string rt= getStringField(commandStr, "resource_type");
        int rid  = getIntField(commandStr, "resource_id", 0);
        int hid  = getIntField(commandStr, "hospital_id", -1);

        ResourceType rtype = ResourceType::AMBULANCE;
        if (rt == "BED")    rtype = ResourceType::BED;
        if (rt == "DOCTOR") rtype = ResourceType::DOCTOR;

        Request req;
        req.emergency_id  = eid;
        req.resource_type = rtype;
        req.resource_id   = rid;
        req.hospital_id   = hid;
        req.priority      = 1;

        cout.rdbuf(devNull.rdbuf());
        DecisionResult result = rm.processRequest(req);
        cout.rdbuf(origCout);

        string dec = "REJECTED";
        if (result.decision == Decision::APPROVED) dec = "APPROVED";
        else if (result.decision == Decision::WAITING) dec = "WAITING";

        // Escape quotes in reason for JSON safety
        string reason = result.reason;
        replace(reason.begin(), reason.end(), '"', '\'');

        cout << "{\"decision\":\"" << dec << "\",\"reason\":\"" << reason << "\"}" << endl;

    } else if (action == "releaseResource") {
        int eid  = getIntField(commandStr, "emergency_id", -1);
        string rt= getStringField(commandStr, "resource_type");
        int rid  = getIntField(commandStr, "resource_id", 0);

        ResourceType rtype = ResourceType::AMBULANCE;
        if (rt == "BED")    rtype = ResourceType::BED;
        if (rt == "DOCTOR") rtype = ResourceType::DOCTOR;

        cout.rdbuf(devNull.rdbuf());
        rm.releaseResource(eid, rtype, rid);
        cout.rdbuf(origCout);

        cout << "{\"ok\":true,\"message\":\"Resource released\"}" << endl;

    } else if (action == "cancelEmergency") {
        int eid = getIntField(commandStr, "emergency_id", 0);

        cout.rdbuf(devNull.rdbuf());
        rm.cancelEmergency(eid);
        cout.rdbuf(origCout);

        cout << "{\"ok\":true,\"message\":\"Emergency cancelled\"}" << endl;

    } else if (action == "getState") {
        cout.rdbuf(devNull.rdbuf());
        rm.printState();
        cout.rdbuf(origCout);
        cout << "{\"ok\":true,\"message\":\"State printed to stderr\"}" << endl;

    } else if (action == "detectDeadlock") {
        // Edges format: {"from":"R1","to":"E1"}
        DeadlockDetector detector;
        string allocArr = extractArray(commandStr, "allocationEdges");
        string reqArr   = extractArray(commandStr, "requestEdges");

        vector<pair<string,string>> allocEdges, reqEdges;
        for (auto& obj : splitObjects(allocArr)) {
            string f = getStringField(obj, "from");
            string t = getStringField(obj, "to");
            if (!f.empty() && !t.empty()) allocEdges.push_back({f, t});
        }
        for (auto& obj : splitObjects(reqArr)) {
            string f = getStringField(obj, "from");
            string t = getStringField(obj, "to");
            if (!f.empty() && !t.empty()) reqEdges.push_back({f, t});
        }

        detector.buildGraph(allocEdges, reqEdges);

        ostringstream capOut;
        cout.rdbuf(capOut.rdbuf());
        bool deadlock = detector.checkForDeadlock();
        cout.rdbuf(origCout);

        int totalNodes = (int)(allocEdges.size() + reqEdges.size());
        (void)totalNodes;        string msg = deadlock
            ? "Cycle detected in Resource Allocation Graph — DEADLOCK present"
            : "No cycle found in Resource Allocation Graph — system is safe";
        cout << "{\"deadlockDetected\":" << (deadlock ? "true" : "false")
             << ",\"message\":\"" << msg << "\""
             << ",\"allocationEdges\":" << (int)allocEdges.size()
             << ",\"requestEdges\":"   << (int)reqEdges.size()
             << "}" << endl;

    } else if (action == "starvationTick") {
        int ticks = getIntField(commandStr, "ticks", 1);
        if (ticks < 1) ticks = 1;
        if (ticks > 20) ticks = 20;

        string wreqArr = extractArray(commandStr, "waitingRequests");
        StarvationHandler sh;
        for (auto& obj : splitObjects(wreqArr)) {
            WaitingRequest wr;
            wr.emergency_id      = getIntField(obj, "emergency_id", 0);
            wr.resource_id       = getIntField(obj, "resource_id", 0);
            wr.basePriority      = getIntField(obj, "basePriority", 4);
            wr.effectivePriority = wr.basePriority;
            wr.waiting_time      = 0;
            string rts           = getStringField(obj, "resource_type");
            if (rts == "BED")         wr.resource_type = ResourceType::BED;
            else if (rts == "DOCTOR") wr.resource_type = ResourceType::DOCTOR;
            else                      wr.resource_type = ResourceType::AMBULANCE;
            sh.addWaitingRequest(wr);
        }

        for (int i = 0; i < ticks; i++) sh.tick();

        bool starving = sh.checkStarvation();
        const auto& q = sh.getQueue();

        ostringstream out;
        out << "{\"ticks\":" << ticks
            << ",\"starvationDetected\":" << (starving ? "true" : "false")
            << ",\"queueSize\":" << (int)q.size()
            << ",\"queue\":[";
        for (size_t i = 0; i < q.size(); i++) {
            if (i) out << ",";
            string rtStr = "AMBULANCE";
            if (q[i].resource_type == ResourceType::BED)    rtStr = "BED";
            if (q[i].resource_type == ResourceType::DOCTOR) rtStr = "DOCTOR";
            out << "{\"emergency_id\":" << q[i].emergency_id
                << ",\"resource_id\":"  << q[i].resource_id
                << ",\"resource_type\":\"" << rtStr << "\""
                << ",\"basePriority\":" << q[i].basePriority
                << ",\"effectivePriority\":" << q[i].effectivePriority
                << ",\"waiting_time\":"  << q[i].waiting_time
                << "}";
        }
        out << "]}";
        cout << out.str() << endl;

    } else if (action == "semaphoreDemo") {
        int permits    = getIntField(commandStr, "permits",    3);
        int numThreads = getIntField(commandStr, "numThreads", 8);
        if (permits    < 1)  permits    = 1;
        if (permits    > 20) permits    = 20;
        if (numThreads < 1)  numThreads = 1;
        if (numThreads > 50) numThreads = 50;

        SemaphoreDemo demo(permits);
        int peak = demo.run(numThreads);

        cout << "{\"permits\":" << permits
             << ",\"numThreads\":" << numThreads
             << ",\"peakConcurrent\":" << peak
             << ",\"message\":\"Semaphore enforced max " << permits
             << " concurrent thread(s) out of " << numThreads << " total\"}" << endl;

    } else {
        cout << "{\"error\":\"Unknown action: " << action << "\"}" << endl;
        return 1;
    }

    return 0;
}
