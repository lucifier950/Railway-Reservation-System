#include <iostream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <limits>
#include <algorithm>
#include <string>
#include <ctime>
#include <sstream>
#include <cstring>
#include <climits>

// Simple HTTP Server Headers
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
    #define SOCKET int
    #define INVALID_SOCKET -1
    #define SOCKET_ERROR -1
    #define closesocket close
#endif

using namespace std;

// --- CLASS DEFINITIONS ---

// Station Class
class Station {
private:
    string name;
    int id;

public:
    Station() : name(""), id(-1) {}
    Station(string n, int i) : name(n), id(i) {}
    
    string getName() const { return name; }
    int getId() const { return id; }

    string toJSON() const {
        stringstream ss;
        ss << "{\"id\":" << id << ",\"name\":\"" << name << "\"}";
        return ss.str();
    }
};

// Edge Class
class Edge {
private:
    int dest;
    int time;
    int cost;

public:
    Edge() : dest(-1), time(0), cost(0) {}
    Edge(int d, int t, int c) : dest(d), time(t), cost(c) {}
    
    int getDest() const { return dest; }
    int getTime() const { return time; }
    int getCost() const { return cost; }
};

// Result structure for path finding
struct PathResult {
    vector<int> path;
    int distance;
};

// Railway Graph Class
class RailwayGraph {
private:
    int numStations;
    unordered_map<int, Station> stations;
    unordered_map<int, vector<Edge>> adjList;

public:
    RailwayGraph(int n) : numStations(n) {}

    void addStation(int id, string name) {
        stations[id] = Station(name, id);
    }

    void addRoute(int src, int dest, int time, int cost, bool checkReverse = true) {
        // Simple check to prevent adding duplicates
        for (const auto& edge : adjList[src]) {
            if (edge.getDest() == dest) return;
        }

        adjList[src].push_back(Edge(dest, time, cost));
        if (checkReverse) {
            adjList[dest].push_back(Edge(src, time, cost));
        }
    }

    PathResult findShortestPath(int src, int dest, bool byTime = true) {
        // Dijkstra's Algorithm
        vector<int> dist(numStations, INT_MAX);
        vector<int> parent(numStations, -1);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;

        dist[src] = 0;
        pq.push(make_pair(0, src));

        while (!pq.empty()) {
            int u = pq.top().second;
            int d = pq.top().first;
            pq.pop();

            if (d > dist[u]) continue;

            for (size_t i = 0; i < adjList[u].size(); i++) {
                const Edge& e = adjList[u][i];
                int weight = byTime ? e.getTime() : e.getCost();
                if (dist[u] != INT_MAX && dist[u] + weight < dist[e.getDest()]) {
                    dist[e.getDest()] = dist[u] + weight;
                    parent[e.getDest()] = u;
                    pq.push(make_pair(dist[e.getDest()], e.getDest()));
                }
            }
        }

        // Reconstruct path
        vector<int> path;
        PathResult result;
        
        if (dist[dest] == INT_MAX) {
            result.path = path;
            result.distance = -1;
            return result;
        }

        for (int v = dest; v != -1; v = parent[v]) {
            path.push_back(v);
        }
        reverse(path.begin(), path.end());

        result.path = path;
        result.distance = dist[dest];
        return result;
    }

    string getAllStations() {
        stringstream ss;
        ss << "[";
        int count = 0;
        for (int i = 0; i < numStations; i++) {
            if (stations.count(i)) {
                if (count > 0) ss << ",";
                ss << stations[i].toJSON();
                count++;
            }
        }
        ss << "]";
        return ss.str();
    }
};


// Booking Request Class
class BookingRequest {
private:
    int id;
    string passengerName;
    int from;
    int to;
    int timestamp;
    bool processed;

public:
    BookingRequest() : id(0), passengerName(""), from(-1), to(-1), timestamp(0), processed(false) {}
    BookingRequest(int i, string name, int f, int t, int ts, bool p = false) 
        : id(i), passengerName(name), from(f), to(t), timestamp(ts), processed(p) {}
    
    int getId() const { return id; }
    string getPassengerName() const { return passengerName; }
    int getFrom() const { return from; }
    int getTo() const { return to; }
    
    void setProcessed(bool p) { processed = p; }
    
    bool operator<(const BookingRequest& other) const {
        return timestamp > other.timestamp; // Priority queue sorts by oldest first
    }

    string toJSON() const {
        stringstream ss;
        ss << "{\"id\":" << id 
           << ",\"name\":\"" << passengerName 
           << "\",\"from\":" << from 
           << ",\"to\":" << to 
           << ",\"timestamp\":" << timestamp 
           << ",\"processed\":" << (processed ? "true" : "false") << "}";
        return ss.str();
    }
};


// Booking System Class (In-Memory Only)
class BookingSystem {
private:
    priority_queue<BookingRequest> bookingQueue;
    vector<BookingRequest> completedBookings;
    int nextId;

public:
    BookingSystem() : nextId(1) {}

    int addBooking(string name, int from, int to) {
        BookingRequest req(nextId++, name, from, to, (int)time(0));
        bookingQueue.push(req);
        cout << " [INFO] Added booking ID: " << req.getId() << ". Waiting for Admin confirmation.\n";
        return req.getId();
    }

    string processBooking(RailwayGraph& graph) {
        if (bookingQueue.empty()) {
            return "{\"error\":\"No pending bookings\"}";
        }

        BookingRequest req = bookingQueue.top();
        bookingQueue.pop();

        PathResult pathTimeResult = graph.findShortestPath(req.getFrom(), req.getTo(), true);
        PathResult pathCostResult = graph.findShortestPath(req.getFrom(), req.getTo(), false);

        if (pathTimeResult.distance == -1) {
            return "{\"error\":\"No route available\"}";
        }

        // Generate JSON response for confirmed ticket
        stringstream ss;
        ss << "{\"id\":" << req.getId()
           << ",\"name\":\"" << req.getPassengerName()
           << "\",\"from\":" << req.getFrom()
           << ",\"to\":" << req.getTo()
           << ",\"fastestTime\":" << pathTimeResult.distance
           << ",\"cheapestCost\":" << pathCostResult.distance
           << ",\"fastestPath\":[";
        
        for (size_t i = 0; i < pathTimeResult.path.size(); i++) {
            ss << pathTimeResult.path[i];
            if (i < pathTimeResult.path.size() - 1) ss << ",";
        }
        ss << "],\"cheapestPath\":[";
        
        for (size_t i = 0; i < pathCostResult.path.size(); i++) {
            ss << pathCostResult.path[i];
            if (i < pathCostResult.path.size() - 1) ss << ",";
        }
        ss << "]}";

        // Move to completed bookings (in-memory only)
        req.setProcessed(true);
        completedBookings.push_back(req);
        cout << " [CONFIRMED] Booking ID: " << req.getId() << " confirmed by Admin.\n";

        return ss.str();
    }

    string getPendingBookings() {
        priority_queue<BookingRequest> temp = bookingQueue;
        stringstream ss;
        ss << "[";
        bool first = true;
        while (!temp.empty()) {
            if (!first) ss << ",";
            ss << temp.top().toJSON();
            temp.pop();
            first = false;
        }
        ss << "]";
        return ss.str();
    }

    string getCompletedBookings() {
        stringstream ss;
        ss << "[";
        for (size_t i = 0; i < completedBookings.size(); i++) {
            ss << completedBookings[i].toJSON();
            if (i < completedBookings.size() - 1) ss << ",";
        }
        ss << "]";
        return ss.str();
    }
};


// Global instances
RailwayGraph* railway = NULL;
BookingSystem* bookingSystem = NULL;

// --- HTTP SERVER HELPERS ---
string urlDecode(const string& str) {
    string result;
    for (size_t i = 0; i < str.length(); i++) {
        if (str[i] == '%' && i + 2 < str.length()) {
            int value;
            sscanf(str.substr(i + 1, 2).c_str(), "%x", &value);
            result += static_cast<char>(value);
            i += 2;
        } else if (str[i] == '+') {
            result += ' ';
        } else {
            result += str[i];
        }
    }
    return result;
}

string parseQueryParam(const string& query, const string& param) {
    size_t pos = query.find(param + "=");
    if (pos == string::npos) return "";
    
    size_t start = pos + param.length() + 1;
    size_t end = query.find("&", start);
    if (end == string::npos) end = query.length();
    
    return urlDecode(query.substr(start, end - start));
}

string handleRequest(const string& request) {
    
    // CORS headers
    string headers = "HTTP/1.1 200 OK\r\n"
                     "Content-Type: application/json\r\n"
                     "Access-Control-Allow-Origin: *\r\n"
                     "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                     "Access-Control-Allow-Headers: Content-Type\r\n\r\n";

    if (request.find("OPTIONS") == 0) {
        return headers;
    }

    // --- Route Handling Logic ---

    if (request.find("GET /stations") == 0) {
        return headers + railway->getAllStations();
    }

    if (request.find("GET /findRoute") == 0) {
        size_t queryPos = request.find("?");
        string query = request.substr(queryPos + 1, request.find(" HTTP") - queryPos - 1);
        
        int from = atoi(parseQueryParam(query, "from").c_str());
        int to = atoi(parseQueryParam(query, "to").c_str());
        
        PathResult pathTimeResult = railway->findShortestPath(from, to, true);
        PathResult pathCostResult = railway->findShortestPath(from, to, false);
        
        stringstream json;
        json << "{\"fastestTime\":" << pathTimeResult.distance
             << ",\"cheapestCost\":" << pathCostResult.distance
             << ",\"fastestPath\":[";
        for (size_t i = 0; i < pathTimeResult.path.size(); i++) {
            json << pathTimeResult.path[i];
            if (i < pathTimeResult.path.size() - 1) json << ",";
        }
        json << "],\"cheapestPath\":[";
        for (size_t i = 0; i < pathCostResult.path.size(); i++) {
            json << pathCostResult.path[i];
            if (i < pathCostResult.path.size() - 1) json << ",";
        }
        json << "]}";
        
        return headers + json.str();
    }

    if (request.find("POST /addBooking") == 0) {
        size_t bodyPos = request.find("\r\n\r\n");
        string body = request.substr(bodyPos + 4);
        
        string name = parseQueryParam(body, "name");
        int from = atoi(parseQueryParam(body, "from").c_str());
        int to = atoi(parseQueryParam(body, "to").c_str());
        
        int id = bookingSystem->addBooking(name, from, to);
        
        stringstream json;
        json << "{\"success\":true,\"id\":" << id << "}";
        return headers + json.str();
    }

    if (request.find("POST /processBooking") == 0) {
        string result = bookingSystem->processBooking(*railway);
        return headers + result;
    }

    if (request.find("GET /pendingBookings") == 0) {
        return headers + bookingSystem->getPendingBookings();
    }

    if (request.find("GET /completedBookings") == 0) {
        return headers + bookingSystem->getCompletedBookings();
    }

    return headers + "{\"error\":\"Unknown endpoint\"}";
}

void startServer() {
#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        cerr << "WSAStartup failed.\n";
        return;
    }
#endif

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket == INVALID_SOCKET) {
        cerr << "Failed to create socket\n";
        return;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
#else
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(8080);

    if (bind(serverSocket, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        cerr << "Bind failed\n";
        closesocket(serverSocket);
        return;
    }

    if (listen(serverSocket, 10) == SOCKET_ERROR) {
        cerr << "Listen failed\n";
        closesocket(serverSocket);
        return;
    }

    cout << "\n🚀 Railway Server Started (IN-MEMORY MODE)!\n";
    cout << "📡 Listening on http://localhost:8080\n";
    cout << "⚠️ Bookings must be CONFIRMED by Admin and are NOT persistent!\n";
    cout << "🌐 Open login.html in your browser\n";
    cout << "--------------------------------\n";

    while (true) {
        SOCKET clientSocket = accept(serverSocket, NULL, NULL);
        if (clientSocket == INVALID_SOCKET) continue;

        char buffer[4096] = {0};
        int bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);
        if (bytesReceived <= 0) {
            closesocket(clientSocket);
            continue;
        }

        string request(buffer);
        string response = handleRequest(request);

        send(clientSocket, response.c_str(), response.length(), 0);
        closesocket(clientSocket);
    }

    closesocket(serverSocket);
#ifdef _WIN32
    WSACleanup();
#endif
}

void initializeRailwayGraph(RailwayGraph* graph) {
    graph->addStation(0, "Delhi");
    graph->addStation(1, "Agra");
    graph->addStation(2, "Jaipur");
    graph->addStation(3, "Mumbai");
    graph->addStation(4, "Pune");
    graph->addStation(5, "Goa");

    // Time (min), Cost (INR)
    graph->addRoute(0, 1, 120, 500);
    graph->addRoute(0, 2, 180, 700);
    graph->addRoute(1, 2, 150, 600);
    graph->addRoute(1, 3, 480, 1500);
    graph->addRoute(2, 3, 540, 1200);
    graph->addRoute(3, 4, 90, 300);
    graph->addRoute(3, 5, 360, 1000);
    graph->addRoute(4, 5, 270, 800);
}

int main() {
    // 1. Initialize Graph (Hardcoded Data)
    railway = new RailwayGraph(6);
    bookingSystem = new BookingSystem();
    
    initializeRailwayGraph(railway); 

    // 2. Start Server
    startServer();

    // Cleanup
    delete railway;
    delete bookingSystem;

    return 0;
}