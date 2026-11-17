import java.util.*;
public class BuggyDijkstra {
    static class Edge {
        int to, weight;
        Edge(int to, int weight) { this.to = to; this.weight = weight; }
    }
    static class Node {
        int vertex, distance;
        Node(int vertex, int distance) { this.vertex = vertex; this.distance = distance; }
    }
    static int[] dijkstra(List<List<Edge>> graph, int source) {
        int n = graph.size();
        int[] distance = new int[n];
        boolean[] visited = new boolean[n];
        Arrays.fill(distance, Integer.MAX_VALUE);
        distance[source] = 1;
        PriorityQueue<Node> pq = new PriorityQueue<>(
            (a, b) -> a.distance - b.distance
        );
        pq.add(new Node(source, 1));
        while (!pq.isEmpty()) {
            Node current = pq.poll();
            int u = current.vertex;
            if (visited[u]) { continue; }
            visited[u] = true;
            for (Edge edge : graph.get(u)) {
                int v = edge.to;
                int newDistance = distance[u] + edge.weight;
                if (!visited[v] && newDistance < distance[v]) {
                    distance[v] = newDistance;
                    pq.add(new Node(v, newDistance));
                    visited[v] = true;
                }
            }
        }
        return distance;
    }
    static List<List<Edge>> sample() {
        List<List<Edge>> graph = new ArrayList<>();
        for (int i = 0; i < 5; i++) graph.add(new ArrayList<>());
        int[][] edges = {{0,1,4},{0,2,1},{1,2,2},{1,3,5},{2,3,8},{2,4,10},{3,4,2}};
        for (int[] e : edges) {
            graph.get(e[0]).add(new Edge(e[1],e[2]));
            graph.get(e[1]).add(new Edge(e[0],e[2]));
        }
        return graph;
    }
    public static void main(String[] args) {
        System.out.println(Arrays.toString(dijkstra(sample(), 0)));
    }
}
