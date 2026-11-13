#ifndef SYNCHRONIZATION_H
#define SYNCHRONIZATION_H

#include <mutex>
#include <condition_variable>

namespace Member5 {

class Semaphore
{
public:
    explicit Semaphore(int permits);

    void acquire();
    void release();
    int  available() const;

private:
    int                     permits;
    mutable std::mutex      mtx;
    std::condition_variable cv;
};

class SemaphoreDemo
{
public:
    explicit SemaphoreDemo(int permits);

    int run(int numThreads);

private:
    Semaphore  sem;
    int        currentCount;
    int        peakCount;
    std::mutex peakMtx;
};

} // namespace Member5

#endif // SYNCHRONIZATION_H
