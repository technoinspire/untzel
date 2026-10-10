// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Fixed-capacity queues of timed items, kept sorted by frame. Pushing happens in the
//! message handler; `render` only reads from the front and advances, so it never moves
//! or allocates memory.

/// A note or hit for one slot.
#[derive(Clone, Copy)]
pub struct NoteEvent {
    pub slot: u32,
    pub frame: f64,
    pub duration: f64,
    pub note: f32,
    pub velocity: f32,
}

/// A parameter ramp for one slot that starts at `frame`.
#[derive(Clone, Copy)]
pub struct ParamPoint {
    pub slot: u32,
    pub frame: f64,
    pub param: u32,
    pub value: f32,
    pub ramp: u32,
}

pub trait Timed: Copy {
    fn frame(&self) -> f64;
    fn slot(&self) -> u32;
}

impl Timed for NoteEvent {
    fn frame(&self) -> f64 {
        self.frame
    }
    fn slot(&self) -> u32 {
        self.slot
    }
}

impl Timed for ParamPoint {
    fn frame(&self) -> f64 {
        self.frame
    }
    fn slot(&self) -> u32 {
        self.slot
    }
}

pub struct TimedQueue<T: Timed> {
    /// Sorted by frame; items before `head` were already consumed.
    items: Vec<T>,
    head: usize,
    capacity: usize,
}

/// The queue had no room; the item was dropped.
#[derive(Debug, PartialEq, Eq)]
pub struct QueueFull;

impl<T: Timed> TimedQueue<T> {
    /// Allocates; constructor only.
    pub fn with_capacity(capacity: usize) -> Self {
        TimedQueue {
            items: Vec::with_capacity(capacity),
            head: 0,
            capacity,
        }
    }

    /// Inserts after every item with the same frame (push order is kept). Message
    /// handler only: it compacts consumed items, which moves memory.
    pub fn push(&mut self, item: T) -> Result<(), QueueFull> {
        self.compact();
        if self.items.len() >= self.capacity {
            return Err(QueueFull);
        }
        let at = self
            .items
            .partition_point(|queued| queued.frame() <= item.frame());
        self.items.insert(at, item);
        Ok(())
    }

    #[inline]
    pub fn peek(&self) -> Option<&T> {
        self.items.get(self.head)
    }

    /// Removes the front item. Never allocates nor moves memory.
    #[inline]
    pub fn pop(&mut self) -> Option<T> {
        let item = self.items.get(self.head).copied();
        self.head += usize::from(item.is_some());
        item
    }

    /// Drops every pending item at or after `frame`.
    pub fn discard_from(&mut self, frame: f64) {
        let keep =
            self.head + self.items[self.head..].partition_point(|queued| queued.frame() < frame);
        self.items.truncate(keep);
    }

    /// Drops every pending item addressed to `slot`.
    pub fn discard_slot(&mut self, slot: u32) {
        self.compact();
        self.items.retain(|queued| queued.slot() != slot);
    }

    pub fn len(&self) -> usize {
        self.items.len() - self.head
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn compact(&mut self) {
        if self.head > 0 {
            self.items.drain(..self.head);
            self.head = 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(frame: f64, note: f32) -> NoteEvent {
        NoteEvent {
            slot: 0,
            frame,
            duration: 1.0,
            note,
            velocity: 1.0,
        }
    }

    #[test]
    fn items_come_out_by_frame_then_push_order() {
        let mut queue = TimedQueue::with_capacity(8);
        for (frame, note) in [(30.0, 1.0), (10.0, 2.0), (30.0, 3.0), (20.0, 4.0)] {
            queue.push(event(frame, note)).unwrap();
        }
        let notes: Vec<f32> = std::iter::from_fn(|| queue.pop()).map(|e| e.note).collect();
        assert_eq!(notes, [2.0, 4.0, 1.0, 3.0]);
    }

    #[test]
    fn a_full_queue_rejects_and_keeps_its_capacity() {
        let mut queue = TimedQueue::with_capacity(2);
        queue.push(event(1.0, 0.0)).unwrap();
        queue.push(event(2.0, 0.0)).unwrap();
        assert_eq!(queue.push(event(3.0, 0.0)), Err(QueueFull));
        queue.pop();
        assert!(queue.push(event(3.0, 0.0)).is_ok());
        assert_eq!(queue.len(), 2);
    }

    #[test]
    fn discard_from_keeps_only_earlier_items() {
        let mut queue = TimedQueue::with_capacity(8);
        for frame in [5.0, 10.0, 15.0, 20.0] {
            queue.push(event(frame, 0.0)).unwrap();
        }
        queue.pop();
        queue.discard_from(15.0);
        assert_eq!(queue.len(), 1);
        assert_eq!(queue.peek().unwrap().frame, 10.0);
    }
}
