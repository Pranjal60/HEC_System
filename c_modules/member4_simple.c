
#include <stdio.h>
#include <string.h>

#define MAX 20

typedef struct {
    char id[10];
    int arrival, burst, priority;
    int remaining;
    int start, completion;
    int waiting, turnaround, response;
} Process;

void inputProcesses(Process p[], int *n) {
    int i;

    printf("Number of emergencies (1-%d): ", MAX);
    scanf("%d", n);

    if (*n < 1 || *n > MAX) {
        printf("Invalid number of emergencies.\n");
        *n = 0;
        return;
    }

    for (i = 0; i < *n; i++) {
        printf("\nEmergency %d\n", i + 1);
        printf("ID (example E1): ");
        scanf("%9s", p[i].id);

        printf("Arrival time: ");
        scanf("%d", &p[i].arrival);

        printf("Service/burst time: ");
        scanf("%d", &p[i].burst);

        printf("Priority (1 = highest): ");
        scanf("%d", &p[i].priority);

        if (p[i].arrival < 0 || p[i].burst <= 0 || p[i].priority <= 0) {
            printf("Invalid data. Arrival must be >= 0; burst and priority > 0.\n");
            *n = 0;
            return;
        }

        p[i].remaining = p[i].burst;
        p[i].start = -1;
        p[i].completion = 0;
    }
}

void copyProcesses(Process dest[], Process source[], int n) {
    int i;
    for (i = 0; i < n; i++) {
        dest[i] = source[i];
    }
}

void sortByArrival(Process p[], int n) {
    int i, j;
    for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - i - 1; j++) {
            if (p[j].arrival > p[j + 1].arrival) {
                Process temp = p[j];
                p[j] = p[j + 1];
                p[j + 1] = temp;
            }
        }
    }
}

void calculateTimes(Process p[], int n) {
    int i;
    for (i = 0; i < n; i++) {
        p[i].turnaround = p[i].completion - p[i].arrival;
        p[i].waiting = p[i].turnaround - p[i].burst;
        p[i].response = p[i].start - p[i].arrival;
    }
}

void printResult(char title[], Process p[], int n) {
    int i;
    double totalWT = 0, totalTAT = 0, totalRT = 0;

    calculateTimes(p, n);

    printf("\n--- %s ---\n", title);
    printf("ID\tAT\tBT\tCT\tWT\tTAT\tRT\n");

    for (i = 0; i < n; i++) {
        printf("%s\t%d\t%d\t%d\t%d\t%d\t%d\n",
               p[i].id, p[i].arrival, p[i].burst, p[i].completion,
               p[i].waiting, p[i].turnaround, p[i].response);

        totalWT += p[i].waiting;
        totalTAT += p[i].turnaround;
        totalRT += p[i].response;
    }

    printf("Average waiting time: %.2f\n", totalWT / n);
    printf("Average turnaround time: %.2f\n", totalTAT / n);
    printf("Average response time: %.2f\n", totalRT / n);
}

void fcfs(Process input[], int n, Process result[]) {
    int i, time = 0;

    copyProcesses(result, input, n);
    sortByArrival(result, n);

    for (i = 0; i < n; i++) {
        if (time < result[i].arrival) {
            time = result[i].arrival;
        }

        result[i].start = time;
        time += result[i].burst;
        result[i].completion = time;
    }
}

void priorityScheduling(Process input[], int n, Process result[]) {
    int done[MAX] = {0};
    int finished = 0, time = 0, i;

    copyProcesses(result, input, n);

    while (finished < n) {
        int best = -1;

        for (i = 0; i < n; i++) {
            if (!done[i] && result[i].arrival <= time) {
                if (best == -1 ||
                    result[i].priority < result[best].priority) {
                    best = i;
                }
            }
        }

        if (best == -1) {
            time++;
            continue;
        }

        result[best].start = time;
        time += result[best].burst;
        result[best].completion = time;
        done[best] = 1;
        finished++;
    }
}

void roundRobin(Process input[], int n, int quantum, Process result[]) {
    int queue[MAX * 100];
    int front = 0, rear = 0, next = 0;
    int time = 0, finished = 0, i;

    copyProcesses(result, input, n);
    sortByArrival(result, n);

    for (i = 0; i < n; i++) {
        result[i].remaining = result[i].burst;
        result[i].start = -1;
    }

    while (finished < n) {
        if (front == rear && next < n && time < result[next].arrival) {
            time = result[next].arrival;
        }

        while (next < n && result[next].arrival <= time) {
            queue[rear++] = next++;
        }

        if (front == rear) {
            continue;
        }

        i = queue[front++];

        if (result[i].start == -1) {
            result[i].start = time;
        }

        {
            int run = result[i].remaining < quantum
                          ? result[i].remaining : quantum;
            time += run;
            result[i].remaining -= run;
        }

        while (next < n && result[next].arrival <= time) {
            queue[rear++] = next++;
        }

        if (result[i].remaining > 0) {
            queue[rear++] = i;
        } else {
            result[i].completion = time;
            finished++;
        }
    }
}

int main(void) {
    Process input[MAX];
    Process fcfsResult[MAX], priorityResult[MAX], rrResult[MAX];
    int n, quantum;

    printf("HOSPITAL EMERGENCY SCHEDULING - MEMBER 4\n");
    inputProcesses(input, &n);

    if (n == 0) {
        return 1;
    }

    printf("\nRound Robin time quantum: ");
    scanf("%d", &quantum);

    if (quantum <= 0) {
        printf("Time quantum must be greater than zero.\n");
        return 1;
    }

    fcfs(input, n, fcfsResult);
    priorityScheduling(input, n, priorityResult);
    roundRobin(input, n, quantum, rrResult);

    printResult("FCFS", fcfsResult, n);
    printResult("Priority Scheduling", priorityResult, n);
    printResult("Round Robin", rrResult, n);

    return 0;
}
