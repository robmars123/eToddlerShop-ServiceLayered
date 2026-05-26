import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL auto-cleanup requires a global afterEach. Since we don't enable Vitest
// globals, we register it explicitly here once for all test files.
afterEach(cleanup)
