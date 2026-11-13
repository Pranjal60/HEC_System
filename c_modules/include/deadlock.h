#ifndef DEADLOCK_H
#define DEADLOCK_H

#include "models.h"
#include <vector>
#include <map>
#include <set>
#include <string>

// Deadlock detection via Resource Allocation Graph + DFS cycle detection.
// Independent from Banker's Algorithm — used for demonstration purposes.

namespace Member5 {

class DeadlockDetector
{
public:
    void reset();

    void addAllocationEdge(const std::string& resource_node, const std::string& emergency_node);
    void addRequestEdge(const std::string& emergency_node, const std::string& resource_node);

    void buildGraph(const std::vector<std::pair<std::string,std::string>>& allocationEdges,
                    const std::vector<std::pair<std::string,std::string>>& requestEdges);

    bool detectCycle();
    bool checkForDeadlock();
    void printGraph() const;

private:
    std::map<std::string, std::vector<std::string>> graph;

    bool dfs(const std::string& node,
             std::set<std::string>& visited,
             std::set<std::string>& inStack) const;
};

} // namespace Member5

#endif // DEADLOCK_H
