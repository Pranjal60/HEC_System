#ifndef MODELS_H
#define MODELS_H

#include <string>

namespace Member5 {

enum class ResourceType { AMBULANCE, BED, DOCTOR };

enum class Decision { APPROVED, WAITING, REJECTED };

struct DecisionResult
{
    Decision    decision;
    std::string reason; 
};

struct Ambulance
{
    int         ambulance_id;
    std::string type;
    std::string status;            // "AVAILABLE" | "BUSY" | "MAINTENANCE"
    std::string current_location;
};

struct Bed
{
    int         bed_id;
    int         hospital_id;
    std::string bed_type;          // "ICU", "GENERAL", "CARDIAC", etc.
    std::string status;            // "AVAILABLE" | "OCCUPIED"
};

struct Doctor
{
    int         doctor_id;
    int         hospital_id;
    std::string specialization;
    std::string availability;      // "AVAILABLE" | "BUSY" (maps from not_available)
};

// hospital_id = -1 until assignHospital() is called.
// Leave required_bed_type / required_specialization empty ("") if not needed.
struct Emergency
{
    int         emergency_id;
    int         hospital_id;
    int         priority;          // 1 = most critical
    std::string status;            // "ACTIVE" | "RESOLVED" | "CANCELLED"
    std::string required_bed_type;
    std::string required_specialization;
};

// Request::priority is ignored by ResourceManager — it uses the
// priority stored on the Emergency record instead.
struct Request
{
    int          emergency_id;
    ResourceType resource_type;
    int          resource_id;
    int          hospital_id;  // -1 for AMBULANCE
    int          priority;
};

struct WaitingRequest
{
    int          emergency_id;
    ResourceType resource_type;
    int          resource_id;
    int          hospital_id;
    int          basePriority;
    int          waiting_time;
    int          effectivePriority;
};

} // namespace Member5

#endif // MODELS_H
