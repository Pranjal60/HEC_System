CXX      = g++
CXXFLAGS = -std=c++14 -pthread -Wall -Wextra -Iinclude
CC       = gcc
CFLAGS   = -Wall

SRC_DIR = src

# ── Member 4 C scheduler ────────────────────────────────────────────────────
SCHEDULER_TARGET = member4_simple
SCHEDULER_SRC    = member4_simple.c

# ── Member 5 C++ resource server ────────────────────────────────────────────
RESOURCE_TARGET = resource_server
RESOURCE_SRCS   = resource_server.cpp \
                  $(SRC_DIR)/resource_manager.cpp \
                  $(SRC_DIR)/banker.cpp \
                  $(SRC_DIR)/starvation.cpp \
                  $(SRC_DIR)/deadlock.cpp \
                  $(SRC_DIR)/synchronization.cpp

all: $(SCHEDULER_TARGET) $(RESOURCE_TARGET)
	@echo ""
	@echo "✅ Both binaries built:"
	@echo "   ./$(SCHEDULER_TARGET)  — Member 4 scheduling"
	@echo "   ./$(RESOURCE_TARGET)   — Member 5 resource manager"

$(SCHEDULER_TARGET): $(SCHEDULER_SRC)
	$(CC) $(CFLAGS) -o $@ $^
	@echo "✅ Scheduler built: ./$(SCHEDULER_TARGET)"

$(RESOURCE_TARGET): $(RESOURCE_SRCS)
	$(CXX) $(CXXFLAGS) -o $@ $^
	@echo "✅ Resource manager built: ./$(RESOURCE_TARGET)"

clean:
	rm -f $(SCHEDULER_TARGET) $(RESOURCE_TARGET) src/*.o
	@echo "Clean complete."

.PHONY: all clean
