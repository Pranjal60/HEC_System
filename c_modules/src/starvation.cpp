#include "../include/starvation.h"
#include <algorithm>

using namespace std;

namespace Member5 {

void StarvationHandler::addWaitingRequest(WaitingRequest wreq)
{
    for (const auto& existing : waitingQueue)
        if (existing.emergency_id == wreq.emergency_id &&
            existing.resource_type == wreq.resource_type &&
            existing.resource_id == wreq.resource_id)
            return;

    wreq.effectivePriority = wreq.basePriority;
    waitingQueue.push_back(wreq);
    reorderQueue();
}

void StarvationHandler::removeRequest(int emergency_id, ResourceType type, int resource_id)
{
    waitingQueue.erase(
        remove_if(waitingQueue.begin(), waitingQueue.end(),
            [&](const WaitingRequest& w)
            {
                return w.emergency_id == emergency_id &&
                       w.resource_type == type &&
                       w.resource_id == resource_id;
            }),
        waitingQueue.end());
}

void StarvationHandler::removeEmergency(int emergency_id)
{
    waitingQueue.erase(
        remove_if(waitingQueue.begin(), waitingQueue.end(),
            [&](const WaitingRequest& w)
            {
                return w.emergency_id == emergency_id;
            }),
        waitingQueue.end());
}

bool StarvationHandler::isEmpty() const
{
    return waitingQueue.empty();
}

const vector<WaitingRequest>& StarvationHandler::getQueue() const
{
    return waitingQueue;
}

bool StarvationHandler::checkStarvation() const
{
    for (const auto& wreq : waitingQueue)
        if (wreq.waiting_time >= AGING_THRESHOLD)
            return true;

    return false;
}

void StarvationHandler::tick()
{
    updateWaitingTime();
    applyAging();
    reorderQueue();
}

void StarvationHandler::updateWaitingTime()
{
    for (auto& wreq : waitingQueue)
        wreq.waiting_time++;
}

void StarvationHandler::applyAging()
{
    for (auto& wreq : waitingQueue)
    {
        if (wreq.waiting_time >= AGING_THRESHOLD &&
            wreq.waiting_time % AGING_THRESHOLD == 0)
        {
            wreq.effectivePriority = max(1, wreq.effectivePriority - AGING_BONUS);
        }
    }
}

void StarvationHandler::reorderQueue()
{
    stable_sort(waitingQueue.begin(), waitingQueue.end(),
        [](const WaitingRequest& a, const WaitingRequest& b)
        {
            return a.effectivePriority < b.effectivePriority;
        });
}

} // namespace Member5
