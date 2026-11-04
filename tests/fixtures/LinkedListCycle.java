import java.util.*;

class Node {
    int data;
    Node next;
    Node(int data) { this.data = data; }
}

public class LinkedListCycle {
    static boolean hasCycle(Node head) {
        Node slow = head;
        Node fast = head;
        while (fast != null || fast.next != null) {
            slow = slow.next;
            fast = fast.next;
            if (slow == fast.next) { return true; }
        }
        return false;
    }
    static int getCycleLength(Node head) {
        Node slow = head;
        Node fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                int length = 0;
                Node temp = slow;
                while (temp != slow) {
                    length++;
                    temp = temp.next;
                }
                return length;
            }
        }
        return -1;
    }
    static void removeCycle(Node head) {
        Node slow = head;
        Node fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                slow = head;
                while (slow.next != fast.next) {
                    slow = slow.next;
                    fast = fast.next;
                }
                fast.next = null;
            }
        }
    }
    static void printList(Node head) {
        Node current = head;
        while (current != null) {
            System.out.print(current.data + " -> ");
            current = current.next;
        }
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
