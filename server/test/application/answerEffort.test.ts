import { describe, expect, it } from 'vitest';
import { pickableEffort, questionEffort } from '../../src/application/models/answerEffort';

describe('pickableEffort', () => {
  it('offers the configured effort when it is low, medium or high', () => {
    expect(pickableEffort('low')).toBe('low');
    expect(pickableEffort('medium')).toBe('medium');
    expect(pickableEffort('high')).toBe('high');
  });

  it('offers none when the provider leaves thinking to each model or the config names another level', () => {
    expect(pickableEffort(null)).toBeNull();
    expect(pickableEffort('minimal')).toBeNull();
    expect(pickableEffort('xhigh')).toBeNull();
  });
});

describe('questionEffort', () => {
  it('uses the requested effort, or the configured one when none is asked for', () => {
    expect(questionEffort('medium', 'low')).toBe('low');
    expect(questionEffort('medium', 'high')).toBe('high');
    expect(questionEffort('medium', null)).toBe('medium');
    expect(questionEffort('medium', undefined)).toBe('medium');
  });

  it('keeps an effort the picker does not offer, whatever is asked for', () => {
    expect(questionEffort(null, 'high')).toBeNull();
    expect(questionEffort('minimal', 'high')).toBe('minimal');
  });
});
