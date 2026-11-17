import java.util.*;

public class BuggyDijkstra {

    static class Edge {
        int to;
        int weight;

        Edge(int to, int weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    static class Node {
        int vertex;
        int distance;

        Node(int vertex, int distance) {
            this.vertex = vertex;
            this.distance = distance;
        }
    }

    static int[] dijkstra(List<List<Edge>> graph, int source) {

        int n = graph.size();

        int[] distance = new int[n];
        boolean[] visited = new boolean[n];

        Arrays.fill(distance, Integer.MAX_VALUE);

        // BUG 1: Incorrect initial distance
        distance[source] = 1;

        // BUG 2: Comparator can cause integer overflow
        PriorityQueue<Node> pq = new PriorityQueue<>(
            (a, b) -> a.distance - b.distance
        );

        pq.add(new Node(source, 1));

        while (!pq.isEmpty()) {

            Node current = pq.poll();
            int u = current.vertex;

            if (visited[u]) {
                continue;
            }

            visited[u] = true;

            for (Edge edge : graph.get(u)) {

                int v = edge.to;

                // BUG 3: No protection against integer overflow
                int newDistance = distance[u] + edge.weight;

                if (!visited[v] && newDistance < distance[v]) {

                    distance[v] = newDistance;

                    pq.add(new Node(v, newDistance));

                    // BUG 4: Marks node visited before processing it
                    visited[v] = true;
                }
            }
        }

        return distance;
    }

    public static void main(String[] args) {

        int vertices = 5;

        List<List<Edge>> graph = new ArrayList<>();

        for (int i = 0; i < vertices; i++) {
            graph.add(new ArrayList<>());
        }

        // Undirected weighted graph
        graph.get(0).add(new Edge(1, 4));
        graph.get(0).add(new Edge(2, 1));

        graph.get(1).add(new Edge(0, 4));
        graph.get(1).add(new Edge(2, 2));
        graph.get(1).add(new Edge(3, 5));

        graph.get(2).add(new Edge(0, 1));
        graph.get(2).add(new Edge(1, 2));
        graph.get(2).add(new Edge(3, 8));
        graph.get(2).add(new Edge(4, 10));

        graph.get(3).add(new Edge(1, 5));
        graph.get(3).add(new Edge(2, 8));
        graph.get(3).add(new Edge(4, 2));

        graph.get(4).add(new Edge(2, 10));
        graph.get(4).add(new Edge(3, 2));

        int source = 0;

        int[] result = dijkstra(graph, source);

        System.out.println("Shortest distances from source " + source);

        for (int i = 0; i < result.length; i++) {

            if (result[i] == Integer.MAX_VALUE) {
                System.out.println("Vertex " + i + " : INF");
            } else {
                System.out.println("Vertex " + i + " : " + result[i]);
            }
        }
    }
}
