import java.util.*;
public class CorrectedDijkstra {
    static class Edge {
        final int to, weight;
        Edge(int to, int weight) { this.to = to; this.weight = weight; }
    }
    static class Node {
        final int vertex;
        final long distance;
        Node(int vertex, long distance) { this.vertex = vertex; this.distance = distance; }
    }
    static long[] dijkstra(List<List<Edge>> graph, int source) {
        Objects.requireNonNull(graph, "graph");
        int n = graph.size();
        if (source < 0 || source >= n) throw new IllegalArgumentException("Invalid source");
        for (List<Edge> edges : graph) for (Edge edge : edges) {
            if (edge.to < 0 || edge.to >= n || edge.weight < 0)
                throw new IllegalArgumentException("Dijkstra requires valid vertices and nonnegative weights");
        }
        long[] distance = new long[n];
        boolean[] visited = new boolean[n];
        Arrays.fill(distance, Long.MAX_VALUE);
        distance[source] = 0;
        PriorityQueue<Node> pq = new PriorityQueue<>((a, b) -> Long.compare(a.distance, b.distance));
        pq.add(new Node(source, 0));
        while (!pq.isEmpty()) {
            Node current = pq.poll();
            int u = current.vertex;
            if (visited[u]) continue;
            visited[u] = true;
            for (Edge edge : graph.get(u)) {
                int v = edge.to;
                long newDistance = Math.addExact(distance[u], (long) edge.weight);
                if (!visited[v] && newDistance < distance[v]) {
                    distance[v] = newDistance;
                    pq.add(new Node(v, newDistance));
                }
            }
        }
        return distance;
    }
}
