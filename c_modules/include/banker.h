#ifndef BANKER_H
#define BANKER_H

#include "models.h"
#include <vector>
#include <map>

// Banker's Algorithm — deadlock avoidance.

namespace Member5 {

class Banker
{ 
public:
    explicit Banker(int n); // n = number of resource types

    void registerProcess(int emergency_id, std::vector<int> max);
    void removeProcess(int emergency_id);
    bool hasProcess(int emergency_id) const;

    void             setAvailable(std::vector<int> avail);
    std::vector<int> getAvailable() const;

    void calculateNeed();

    bool canGrantRequest(int emergency_id, std::vector<int> requestVec) const;
    bool isSafeState() const;

    void commitAllocation(int emergency_id, std::vector<int> requestVec);
    void undoAllocation(int emergency_id, std::vector<int> releaseVec);

    std::vector<int> getAllocation(int emergency_id) const;
    std::vector<int> getNeed(int emergency_id) const;
    std::vector<int> getMaximum(int emergency_id) const;

private:
    int numResources;

    std::vector<int>                 available;
    std::map<int, std::vector<int>>  allocation;
    std::map<int, std::vector<int>>  maximum;
    std::map<int, std::vector<int>>  need;

    bool safetyAlgorithm(std::vector<int>                avail,
                         std::map<int, std::vector<int>>  alloc,
                         std::map<int, std::vector<int>>  nd) const;
};

} // namespace Member5

#endif // BANKER_H
