public class CorrectedLinkedListCycle {
    static class Node {
        int data;
        Node next;
        Node(int data) { this.data = data; }
    }
    static Node meetingPoint(Node head) {
        Node slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return slow;
        }
        return null;
    }
    static boolean hasCycle(Node head) { return meetingPoint(head) != null; }
    static int getCycleLength(Node head) {
        Node meeting = meetingPoint(head);
        if (meeting == null) return -1;
        int length = 1;
        Node cursor = meeting.next;
        while (cursor != meeting) { length++; cursor = cursor.next; }
        return length;
    }
    static void removeCycle(Node head) {
        Node meeting = meetingPoint(head);
        if (meeting == null) return;
        Node entry = head;
        while (entry != meeting) { entry = entry.next; meeting = meeting.next; }
        Node tail = entry;
        while (tail.next != entry) tail = tail.next;
        tail.next = null;
    }
    // Precondition: remove any cycle before printing; cyclic input never terminates.
    static void printList(Node head) {
        for (Node current = head; current != null; current = current.next)
            System.out.print(current.data + " -> ");
        System.out.println("NULL");
    }
    public static void main(String[] args) {
        Node head = new Node(10);
        head.next = new Node(20);
        head.next.next = new Node(30);
        head.next.next.next = new Node(40);
        head.next.next.next.next = new Node(50);
        head.next.next.next.next.next = head.next.next;
        System.out.println("Cycle: " + hasCycle(head));
        System.out.println("Cycle Length: " + getCycleLength(head));
        removeCycle(head);
        printList(head);
    }
}
