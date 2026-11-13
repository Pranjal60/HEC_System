#include "../include/synchronization.h"
#include <vector>
#include <thread>
#include <chrono>

using namespace std;

namespace Member5 {

Semaphore::Semaphore(int p)
    : permits(p)
{
}

void Semaphore::acquire()
{
    unique_lock<mutex> lock(mtx);

    cv.wait(lock, [this]()
    {
        return permits > 0;
    });

    permits--;
}

void Semaphore::release()
{
    {
        lock_guard<mutex> lock(mtx);
        permits++;
    }

    cv.notify_one();
}

int Semaphore::available() const
{
    lock_guard<mutex> lock(mtx);
    return permits;
}

SemaphoreDemo::SemaphoreDemo(int p)
    : sem(p), currentCount(0), peakCount(0)
{
}

int SemaphoreDemo::run(int numThreads)
{
    currentCount = 0;
    peakCount    = 0;

    vector<thread> threads;

    auto worker = [&]()
    {
        sem.acquire();

        {
            lock_guard<mutex> lock(peakMtx);
            currentCount++;
            if (currentCount > peakCount)
                peakCount = currentCount;
        }

        this_thread::sleep_for(chrono::milliseconds(10));

        {
            lock_guard<mutex> lock(peakMtx);
            currentCount--;
        }

        sem.release();
    };

    for (int i = 0; i < numThreads; i++)
        threads.emplace_back(worker);

    for (auto& th : threads)
        th.join();

    return peakCount;
}

} // namespace Member5
