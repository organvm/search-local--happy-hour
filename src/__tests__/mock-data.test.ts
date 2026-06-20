import { describe, expect, it } from 'vitest';
import {
  MOCK_BARTENDERS,
  MOCK_CALENDAR_EVENTS,
  MOCK_EVENTS,
  MOCK_MENU_ITEMS,
  MOCK_REVIEWS,
  MOCK_SOCIAL_THREADS,
  MOCK_THREAD_MESSAGES,
  MOCK_VENUES,
} from '../lib/mock-data';
import type { DayOfWeek, DealType, DrinkingTheme } from '../lib/types';

const validDays: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const validDealTypes: DealType[] = ['beer', 'wine', 'cocktails', 'food', 'all'];
const validThemes: DrinkingTheme[] = [
  'famous-drunks',
  'literary',
  'archetypal',
  'prohibition',
  'ancient-rome',
];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function expectUniqueIds(items: { id: string }[]) {
  const ids = items.map(item => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe('mock venue data', () => {
  it('uses unique identifiers for every top-level collection', () => {
    expectUniqueIds(MOCK_VENUES);
    expectUniqueIds(MOCK_BARTENDERS);
    expectUniqueIds(Object.values(MOCK_MENU_ITEMS).flat());
    expectUniqueIds(Object.values(MOCK_EVENTS).flat());
    expectUniqueIds(Object.values(MOCK_REVIEWS).flat());
    expectUniqueIds(MOCK_SOCIAL_THREADS);
    expectUniqueIds(Object.values(MOCK_THREAD_MESSAGES).flat());
    expectUniqueIds(MOCK_CALENDAR_EVENTS);
  });

  it('keeps venue embedded bartenders, menu items, and events in sync with their source maps', () => {
    for (const venue of MOCK_VENUES) {
      const bartenders = MOCK_BARTENDERS.filter(bartender => bartender.venueId === venue.id);

      expect(venue.bartenders ?? []).toEqual(bartenders);
      expect(venue.menu ?? []).toEqual(MOCK_MENU_ITEMS[venue.id] ?? []);
      expect(venue.events ?? []).toEqual(MOCK_EVENTS[venue.id] ?? []);
    }
  });

  it('keeps bartender and theme assignments resolvable from venues', () => {
    const venueIds = new Set(MOCK_VENUES.map(venue => venue.id));

    for (const bartender of MOCK_BARTENDERS) {
      const venue = MOCK_VENUES.find(candidate => candidate.id === bartender.venueId);

      expect(venueIds.has(bartender.venueId)).toBe(true);
      expect(venue?.bartenders?.some(candidate => candidate.id === bartender.id)).toBe(true);
      expect(bartender.rating).toBeGreaterThanOrEqual(1);
      expect(bartender.rating).toBeLessThanOrEqual(5);

      if (bartender.thematicStyle) {
        expect(validThemes).toContain(bartender.thematicStyle);
        expect(venue?.drinkingThemes).toContain(bartender.thematicStyle);
      }
    }
  });

  it('defines valid happy-hour deal schedules for each venue', () => {
    for (const venue of MOCK_VENUES) {
      expect(venue.priceLevel).toBeGreaterThanOrEqual(1);
      expect(venue.priceLevel).toBeLessThanOrEqual(3);
      expect(venue.rating).toBeGreaterThanOrEqual(1);
      expect(venue.rating).toBeLessThanOrEqual(5);
      expect(venue.deals.length).toBeGreaterThan(0);

      for (const deal of venue.deals) {
        expect(validDealTypes).toContain(deal.type);
        expect(deal.daysActive.length).toBeGreaterThan(0);
        expect(deal.daysActive.every(day => validDays.includes(day))).toBe(true);
        expect(deal.timeRange.start).toMatch(timePattern);
        expect(deal.timeRange.end).toMatch(timePattern);
      }
    }
  });
});

describe('mock event and review data', () => {
  it('keeps event and review records attached to real venues', () => {
    const venueIds = new Set(MOCK_VENUES.map(venue => venue.id));
    const now = Date.now();

    for (const [venueId, events] of Object.entries(MOCK_EVENTS)) {
      expect(venueIds.has(venueId)).toBe(true);

      for (const event of events) {
        expect(event.startTime).toMatch(timePattern);
        expect(event.endTime).toMatch(timePattern);
        expect(event.rsvpCount).toBeGreaterThanOrEqual(0);
        expect(Date.parse(event.date)).toBeGreaterThan(now);

        if (event.drinkingTheme) {
          expect(validThemes).toContain(event.drinkingTheme);
        }
      }
    }

    for (const [venueId, reviews] of Object.entries(MOCK_REVIEWS)) {
      expect(venueIds.has(venueId)).toBe(true);

      for (const review of reviews) {
        expect(review.venueId).toBe(venueId);
        expect(review.rating).toBeGreaterThanOrEqual(1);
        expect(review.rating).toBeLessThanOrEqual(5);
        expect(Date.parse(review.date)).toBeLessThanOrEqual(now);
        expect(review.helpfulCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('matches calendar events to venues, bartenders, and featured venue events', () => {
    const venuesById = new Map(MOCK_VENUES.map(venue => [venue.id, venue]));
    const bartendersById = new Map(MOCK_BARTENDERS.map(bartender => [bartender.id, bartender]));

    for (const calendarEvent of MOCK_CALENDAR_EVENTS) {
      const venue = venuesById.get(calendarEvent.venueId);

      expect(venue).toBeDefined();
      expect(calendarEvent.venueName).toBe(venue?.name);
      expect(calendarEvent.startTime).toMatch(timePattern);
      expect(calendarEvent.endTime).toMatch(timePattern);
      expect(calendarEvent.rsvpCount).toBeGreaterThanOrEqual(0);

      if (calendarEvent.drinkingTheme) {
        expect(validThemes).toContain(calendarEvent.drinkingTheme);
      }

      if (calendarEvent.bartenderId) {
        const bartender = bartendersById.get(calendarEvent.bartenderId);

        expect(bartender).toBeDefined();
        expect(bartender?.venueId).toBe(calendarEvent.venueId);
      }

      if (calendarEvent.type === 'themed-event') {
        const matchingEvent = MOCK_EVENTS[calendarEvent.venueId]?.find(event =>
          event.title.includes(calendarEvent.title) &&
          event.startTime === calendarEvent.startTime &&
          event.endTime === calendarEvent.endTime &&
          event.rsvpCount === calendarEvent.rsvpCount
        );

        expect(matchingEvent).toBeDefined();
      }
    }
  });
});

describe('mock social thread data', () => {
  it('keeps threads and messages linked to valid app entities', () => {
    const venuesById = new Map(MOCK_VENUES.map(venue => [venue.id, venue]));
    const bartendersById = new Map(MOCK_BARTENDERS.map(bartender => [bartender.id, bartender]));
    const threadsById = new Map(MOCK_SOCIAL_THREADS.map(thread => [thread.id, thread]));

    for (const thread of MOCK_SOCIAL_THREADS) {
      expect(thread.participantCount).toBeGreaterThan(0);
      expect(thread.messageCount).toBeGreaterThan(0);
      expect(Date.parse(thread.lastActivity)).toBeGreaterThanOrEqual(Date.parse(thread.createdAt));

      if (thread.venueId) {
        expect(venuesById.has(thread.venueId)).toBe(true);
      }

      if (thread.author.role === 'the-pourer') {
        const bartender = bartendersById.get(thread.author.id);

        expect(bartender).toBeDefined();
        expect(thread.author.name).toBe(bartender?.name);
      }

      if (thread.drinkingTheme) {
        expect(validThemes).toContain(thread.drinkingTheme);
      }
    }

    for (const [threadId, messages] of Object.entries(MOCK_THREAD_MESSAGES)) {
      const thread = threadsById.get(threadId);

      expect(thread).toBeDefined();

      for (const message of messages) {
        expect(message.threadId).toBe(threadId);
        expect(Date.parse(message.timestamp)).toBeGreaterThanOrEqual(Date.parse(thread!.createdAt));

        for (const reaction of message.reactions) {
          expect(reaction.count).toBeGreaterThanOrEqual(reaction.users.length);
        }
      }
    }
  });
});
