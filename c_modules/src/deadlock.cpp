#include "../include/deadlock.h"
#include <iostream>

using namespace std;

namespace Member5 {

void DeadlockDetector::reset()
{
    graph.clear();
}

void DeadlockDetector::addAllocationEdge(const string& resource_node,
                                          const string& emergency_node)
{
    graph[resource_node].push_back(emergency_node);
}

void DeadlockDetector::addRequestEdge(const string& emergency_node,
                                       const string& resource_node)
{
    graph[emergency_node].push_back(resource_node);
}

void DeadlockDetector::buildGraph(
    const vector<pair<string,string>>& allocationEdges,
    const vector<pair<string,string>>& requestEdges)
{
    reset();
    for (const auto& edge : allocationEdges)
        addAllocationEdge(edge.first, edge.second);
    for (const auto& edge : requestEdges)
        addRequestEdge(edge.first, edge.second);
}

bool DeadlockDetector::detectCycle()
{
    set<string> visited;
    set<string> inStack;

    for (const auto& entry : graph)
    {
        if (!visited.count(entry.first) && dfs(entry.first, visited, inStack))
            return true;
    }

    return false;
}

bool DeadlockDetector::dfs(const string& node,
                            set<string>& visited,
                            set<string>& inStack) const
{
    visited.insert(node);
    inStack.insert(node);

    auto it = graph.find(node);
    if (it != graph.end())
    {
        for (const string& neighbor : it->second)
        {
            if (!visited.count(neighbor))
            {
                if (dfs(neighbor, visited, inStack))
                    return true;
            }
            else if (inStack.count(neighbor))
            {
                return true;
            }
        }
    }

    inStack.erase(node);
    return false;
}

bool DeadlockDetector::checkForDeadlock()
{
    bool hasCycle = detectCycle();
    cout << (hasCycle ? "  [RAG] Result: DEADLOCK DETECTED\n"
                      : "  [RAG] Result: NO DEADLOCK (system is safe)\n");
    return hasCycle;
}

void DeadlockDetector::printGraph() const
{
    cout << "  [RAG] Graph edges:\n";
    for (const auto& entry : graph)
        for (const string& to : entry.second)
            cout << "    " << entry.first << " -> " << to << "\n";
}

} // namespace Member5
