#ifndef STARVATION_H
#define STARVATION_H

#include "models.h"
#include <vector>

namespace Member5 {

class StarvationHandler
{
public:
    static const int AGING_THRESHOLD = 3;
    static const int AGING_BONUS     = 1;

    void addWaitingRequest(WaitingRequest wreq);
    void removeRequest(int emergency_id, ResourceType type, int resource_id);
    void removeEmergency(int emergency_id);

    bool isEmpty() const;
    const std::vector<WaitingRequest>& getQueue() const;

    bool checkStarvation() const;

    void tick();

private:
    std::vector<WaitingRequest> waitingQueue;

    void updateWaitingTime();
    void applyAging();
    void reorderQueue();
};

} // namespace Member5

#endif // STARVATION_H
