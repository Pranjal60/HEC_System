#include "../include/banker.h"
#include <algorithm>
#include <iostream>

using namespace std;

namespace Member5 {

// Banker's Algorithm — deadlock avoidance

Banker::Banker(int n) : numResources(n)
{
    available.resize(n, 0);
}

void Banker::registerProcess(int emergency_id, vector<int> max)
{
    if (max.size() != static_cast<size_t>(numResources))
    {
        cerr << "[Banker] ERROR: max vector size mismatch. Expected "
             << numResources << ", got " << max.size() << endl;
        return;
    }
    maximum[emergency_id]    = max;
    allocation[emergency_id] = vector<int>(numResources, 0);
    need[emergency_id]       = max; // Need = Maximum initially
}

void Banker::removeProcess(int emergency_id)
{
    allocation.erase(emergency_id);
    maximum.erase(emergency_id);
    need.erase(emergency_id);
}

bool Banker::hasProcess(int emergency_id) const
{
    return maximum.find(emergency_id) != maximum.end();
}

void Banker::setAvailable(vector<int> avail)
{
    if (avail.size() != static_cast<size_t>(numResources))
    {
        cerr << "[Banker] ERROR: available vector size mismatch." << endl;
        return;
    }
    available = avail;
}

vector<int> Banker::getAvailable() const { return available; }

void Banker::calculateNeed()
{
    for (auto& entry : maximum)
    {
        int eid = entry.first;
        need[eid].resize(numResources);
        for (int i = 0; i < numResources; ++i)
            need[eid][i] = maximum[eid][i] - allocation[eid][i];
    }
}

bool Banker::canGrantRequest(int emergency_id, vector<int> requestVec) const
{
    if (requestVec.size() != static_cast<size_t>(numResources))
    {
        cerr << "[Banker] ERROR: request vector size mismatch." << endl;
        return false;
    }
    if (!hasProcess(emergency_id))
    {
        cerr << "[Banker] ERROR: Emergency " << emergency_id << " not registered." << endl;
        return false;
    }

    // 1. Request <= Need
    for (int i = 0; i < numResources; ++i)
        if (requestVec[i] > need.at(emergency_id)[i]) return false;

    // 2. Request <= Available
    for (int i = 0; i < numResources; ++i)
        if (requestVec[i] > available[i]) return false;

    // 3. Pretend-allocate and run safety check on temporary state
    vector<int> temp_available      = available;
    map<int, vector<int>> temp_alloc = allocation;
    map<int, vector<int>> temp_need  = need;

    for (int i = 0; i < numResources; ++i)
    {
        temp_available[i]            -= requestVec[i];
        temp_alloc[emergency_id][i]  += requestVec[i];
        temp_need[emergency_id][i]   -= requestVec[i];
    }

    return safetyAlgorithm(temp_available, temp_alloc, temp_need);
}

void Banker::commitAllocation(int emergency_id, vector<int> requestVec)
{
    for (int i = 0; i < numResources; ++i)
    {
        available[i]                  -= requestVec[i];
        allocation[emergency_id][i]   += requestVec[i];
    }
    calculateNeed();
}

void Banker::undoAllocation(int emergency_id, vector<int> releaseVec)
{
    for (int i = 0; i < numResources; ++i)
    {
        available[i]                  += releaseVec[i];
        allocation[emergency_id][i]   -= releaseVec[i];
    }
    calculateNeed();
}

bool Banker::isSafeState() const
{
    return safetyAlgorithm(available, allocation, need);
}

bool Banker::safetyAlgorithm(vector<int>           avail,
                              map<int,vector<int>>  alloc,
                              map<int,vector<int>>  nd) const
{
    vector<int> work = avail;
    map<int, bool> finish;
    for (auto& entry : alloc) finish[entry.first] = false;

    bool progress = true;
    while (progress)
    {
        progress = false;
        for (auto& entry : alloc)
        {
            int eid = entry.first;
            if (finish[eid]) continue;

            bool canFinish = true;
            for (int i = 0; i < numResources; ++i)
                if (nd[eid][i] > work[i]) { canFinish = false; break; }

            if (canFinish)
            {
                for (int i = 0; i < numResources; ++i)
                    work[i] += alloc[eid][i];
                finish[eid] = true;
                progress = true;
            }
        }
    }

    for (auto& entry : finish)
        if (!entry.second) return false; // UNSAFE

    return true; // SAFE
}

vector<int> Banker::getAllocation(int emergency_id) const
{
    auto it = allocation.find(emergency_id);
    return it != allocation.end() ? it->second : vector<int>(numResources, 0);
}

vector<int> Banker::getNeed(int emergency_id) const
{
    auto it = need.find(emergency_id);
    return it != need.end() ? it->second : vector<int>(numResources, 0);
}

vector<int> Banker::getMaximum(int emergency_id) const
{
    auto it = maximum.find(emergency_id);
    return it != maximum.end() ? it->second : vector<int>(numResources, 0);
}

} // namespace Member5
