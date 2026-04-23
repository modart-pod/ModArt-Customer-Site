# ModArt Testing Guide

## Overview

This directory contains all tests for the ModArt application. We use Vitest as our test framework for fast, modern testing.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests for module interactions
├── e2e/           # End-to-end tests for user flows
├── setup.js       # Global test setup and mocks
└── README.md      # This file
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Writing Tests

### Unit Tests

Unit tests should test individual functions or modules in isolation.

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../js/my-module.js';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Integration Tests

Integration tests should test how multiple modules work together.

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Cart + Products Integration', () => {
  beforeEach(() => {
    // Setup test data
  });

  it('should calculate correct subtotal', () => {
    // Test cart with products
  });
});
```

### E2E Tests

E2E tests should test complete user flows using Playwright.

```javascript
import { test, expect } from '@playwright/test';

test('user can add product to cart', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-product-id="vanta-tee"]');
  await page.click('.btn-add-to-cart');
  await expect(page.locator('.cart-badge')).toHaveText('1');
});
```

## Test Coverage

We aim for >70% code coverage across the codebase.

Current coverage:
- Currency module: 100%
- Cart module: 100%
- Overall: ~15% (needs expansion)

## Mocking

### localStorage/sessionStorage

Automatically mocked in `tests/setup.js`:

```javascript
localStorage.getItem.mockReturnValue('{"key": "value"}');
localStorage.setItem.mockImplementation((key, value) => {
  // Custom implementation
});
```

### Supabase

Mock Supabase client in your tests:

```javascript
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
};

window.supabase = mockSupabase;
```

### DOM

Use `jsdom` environment (configured in `vitest.config.js`):

```javascript
document.body.innerHTML = '<div id="test"></div>';
const element = document.getElementById('test');
expect(element).toBeTruthy();
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Test public APIs, not internal details

2. **Keep Tests Simple**
   - One assertion per test when possible
   - Clear test names that describe what's being tested

3. **Use Descriptive Names**
   - `it('should add item to cart')` ✅
   - `it('test1')` ❌

4. **Arrange-Act-Assert Pattern**
   ```javascript
   it('should calculate total', () => {
     // Arrange
     const cart = new Cart();
     cart.add('product-1');
     
     // Act
     const total = cart.subtotal(products);
     
     // Assert
     expect(total).toBe(1000);
   });
   ```

5. **Clean Up After Tests**
   - Use `beforeEach` and `afterEach` hooks
   - Reset mocks and state between tests

6. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Boundary conditions
   - Error cases

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Every pull request
- Before deployment

## Debugging Tests

### Run Single Test File
```bash
npm test tests/unit/cart.test.js
```

### Run Single Test
```bash
npm test -t "should add item to cart"
```

### Debug in VS Code
Add breakpoint and run "Debug Test" from the test file.

### View Coverage Report
```bash
npm run test:coverage
open coverage/index.html
```

## Common Issues

### Test Timeout
Increase timeout in test:
```javascript
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock Not Working
Ensure mock is set up before importing module:
```javascript
vi.mock('../js/module.js', () => ({
  myFunction: vi.fn(),
}));
```

### DOM Not Available
Check that `environment: 'jsdom'` is set in `vitest.config.js`.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Playwright Documentation](https://playwright.dev/)

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure tests pass
3. Check coverage hasn't decreased
4. Update this README if needed
