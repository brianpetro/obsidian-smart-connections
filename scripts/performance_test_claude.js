#!/usr/bin/env node

/**
 * CLAUDE CODE CLI PERFORMANCE TESTING SCRIPT
 * ===========================================
 * 
 * This script performs comprehensive performance testing for the Claude Code CLI integration.
 * It measures response times, resource usage, throughput, and stress testing scenarios.
 * 
 * Usage:
 *   node scripts/performance_test_claude.js
 *   node scripts/performance_test_claude.js --iterations 100
 *   node scripts/performance_test_claude.js --concurrent 10
 *   node scripts/performance_test_claude.js --stress-test
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const iterations = parseInt(args.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || '50');
const concurrent = parseInt(args.find(arg => arg.startsWith('--concurrent='))?.split('=')[1] || '5');
const stressTest = args.includes('--stress-test');
const verbose = args.includes('--verbose');

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * Performance metrics collector
 */
class PerformanceMetrics {
  constructor() {
    this.measurements = {};
    this.memorySnapshots = [];
    this.errors = [];
  }
  
  startMeasure(name) {
    performance.mark(`${name}-start`);
  }
  
  endMeasure(name) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name).pop();
    if (!this.measurements[name]) {
      this.measurements[name] = [];
    }
    this.measurements[name].push(measure.duration);
    
    return measure.duration;
  }
  
  recordMemory(label) {
    const memory = process.memoryUsage();
    this.memorySnapshots.push({
      label,
      timestamp: Date.now(),
      ...memory
    });
  }
  
  recordError(error, context) {
    this.errors.push({
      error: error.message,
      context,
      timestamp: Date.now()
    });
  }
  
  getStats(name) {
    const measurements = this.measurements[name];
    if (!measurements || measurements.length === 0) {
      return null;
    }
    
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  getMemoryDelta() {
    if (this.memorySnapshots.length < 2) return null;
    
    const initial = this.memorySnapshots[0];
    const final = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    return {
      heapUsed: final.heapUsed - initial.heapUsed,
      heapTotal: final.heapTotal - initial.heapTotal,
      external: final.external - initial.external,
      rss: final.rss - initial.rss
    };
  }
}

const metrics = new PerformanceMetrics();

/**
 * Create mock environment for testing
 */
function createMockEnvironment() {
  return {
    smart_sources: {
      search: async (query, opts = {}) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
        
        const resultCount = opts.limit || 5;
        return Array(resultCount).fill().map((_, i) => ({
          item: {
            path: `test-notes/performance-test-${i}.md`,
            content: `This is performance test content ${i} for query "${query}". `.repeat(10) +
                    `It contains relevant information about the query and additional context. ` +
                    `The content is designed to test the performance of context processing and formatting.`
          },
          score: Math.random() * 0.5 + 0.5 // Random score between 0.5 and 1.0
        }));
      }
    },
    smart_view: {
      active_note: {
        basename: 'performance-active-note.md',
        content: 'This is the content of the currently active note for performance testing. '.repeat(20) +
                'It simulates a typical note that might be open in Obsidian while using the chat feature.'
      }
    }
  };
}

/**
 * Test context gathering performance
 */
async function testContextGathering(adapter, testCases) {
  console.log(`\n${colors.cyan}Testing Context Gathering Performance...${colors.reset}`);
  
  const queries = [
    'simple test query',
    'How do I configure Claude Code CLI with my Obsidian vault settings and preferences?',
    'performance testing memory usage optimization javascript code analysis debugging',
    'A'.repeat(100), // Short query
    'What are the best practices for using AI assistants in note-taking workflows with semantic search, embeddings, natural language processing, and knowledge management systems in Obsidian?', // Long query
  ];
  
  for (const query of queries) {
    console.log(`  Testing query length: ${query.length} characters`);
    
    for (let i = 0; i < iterations / queries.length; i++) {
      try {
        metrics.startMeasure('context-gathering');
        const context = await adapter.gather_context(query);
        const duration = metrics.endMeasure('context-gathering');
        
        if (verbose && i === 0) {
          console.log(`    Sample context length: ${context.length} characters`);
        }
        
        // Test with different context limits
        if (adapter.main && adapter.main.env && adapter.main.env.smart_sources) {
          const originalSearch = adapter.main.env.smart_sources.search;
          
          // Test with more results
          adapter.main.env.smart_sources.search = async (q, opts) => {
            return await originalSearch(q, { ...opts, limit: 10 });
          };
          
          metrics.startMeasure('context-gathering-large');
          await adapter.gather_context(query);
          metrics.endMeasure('context-gathering-large');
          
          // Restore original
          adapter.main.env.smart_sources.search = originalSearch;
        }
        
      } catch (error) {
        metrics.recordError(error, `context-gathering-query-${query.length}`);
      }
    }
  }
  
  const stats = metrics.getStats('context-gathering');
  const largeStats = metrics.getStats('context-gathering-large');
  
  if (stats) {
    console.log(`  ${colors.green}Context Gathering Results:${colors.reset}`);
    console.log(`    Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`    Median: ${stats.median.toFixed(2)}ms`);
    console.log(`    95th percentile: ${stats.p95.toFixed(2)}ms`);
    console.log(`    Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`);
  }
  
  if (largeStats) {
    console.log(`  ${colors.yellow}Large Context Results:${colors.reset}`);
    console.log(`    Mean: ${largeStats.mean.toFixed(2)}ms`);
    console.log(`    95th percentile: ${largeStats.p95.toFixed(2)}ms`);
  }
}

/**
 * Test prompt formatting performance
 */
async function testPromptFormatting(adapter) {
  console.log(`\n${colors.cyan}Testing Prompt Formatting Performance...${colors.reset}`);
  
  const conversationLengths = [1, 5, 10, 20, 50];
  
  for (const length of conversationLengths) {
    console.log(`  Testing conversation length: ${length} messages`);
    
    // Create mock conversation
    const messages = Array(length).fill().map((_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `This is message ${i + 1} in a conversation of ${length} messages. `.repeat(5) +
              `It contains various content types and represents typical chat interactions.`
    }));
    
    for (let i = 0; i < iterations / conversationLengths.length; i++) {
      try {
        metrics.startMeasure(`prompt-formatting-${length}`);
        const prompt = await adapter.format_prompt(messages);
        metrics.endMeasure(`prompt-formatting-${length}`);
        
        if (verbose && i === 0) {
          console.log(`    Sample prompt length: ${prompt.length} characters`);
        }
      } catch (error) {
        metrics.recordError(error, `prompt-formatting-${length}`);
      }
    }
    
    const stats = metrics.getStats(`prompt-formatting-${length}`);
    if (stats) {
      console.log(`    Mean: ${stats.mean.toFixed(2)}ms, 95th: ${stats.p95.toFixed(2)}ms`);
    }
  }
}

/**
 * Test concurrent processing performance
 */
async function testConcurrentProcessing(adapter) {
  console.log(`\n${colors.cyan}Testing Concurrent Processing Performance...${colors.reset}`);
  console.log(`  Running ${concurrent} concurrent operations for ${iterations} iterations each`);
  
  metrics.recordMemory('concurrent-start');
  
  const startTime = Date.now();
  
  // Create concurrent tasks
  const tasks = Array(concurrent).fill().map(async (_, workerIndex) => {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        metrics.startMeasure('concurrent-context');
        const context = await adapter.gather_context(`concurrent test ${workerIndex}-${i}`);
        const contextDuration = metrics.endMeasure('concurrent-context');
        
        metrics.startMeasure('concurrent-format');
        const prompt = await adapter.format_prompt([
          { role: 'user', content: `Concurrent test message ${workerIndex}-${i}` }
        ]);
        const formatDuration = metrics.endMeasure('concurrent-format');
        
        results.push({
          contextDuration,
          formatDuration,
          contextLength: context.length,
          promptLength: prompt.length
        });
        
        // Add small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1));
        
      } catch (error) {
        metrics.recordError(error, `concurrent-worker-${workerIndex}-${i}`);
      }
    }
    
    return results;
  });
  
  const allResults = await Promise.all(tasks);
  const totalTime = Date.now() - startTime;
  
  metrics.recordMemory('concurrent-end');
  
  const totalOperations = allResults.reduce((sum, results) => sum + results.length, 0);
  const throughput = (totalOperations / totalTime) * 1000; // operations per second
  
  console.log(`  ${colors.green}Concurrent Processing Results:${colors.reset}`);
  console.log(`    Total time: ${totalTime}ms`);
  console.log(`    Total operations: ${totalOperations}`);
  console.log(`    Throughput: ${throughput.toFixed(2)} ops/sec`);
  
  const contextStats = metrics.getStats('concurrent-context');
  const formatStats = metrics.getStats('concurrent-format');
  
  if (contextStats) {
    console.log(`    Context gathering - Mean: ${contextStats.mean.toFixed(2)}ms, 95th: ${contextStats.p95.toFixed(2)}ms`);
  }
  
  if (formatStats) {
    console.log(`    Prompt formatting - Mean: ${formatStats.mean.toFixed(2)}ms, 95th: ${formatStats.p95.toFixed(2)}ms`);
  }
}

/**
 * Test memory usage patterns
 */
async function testMemoryUsage(adapter) {
  console.log(`\n${colors.cyan}Testing Memory Usage Patterns...${colors.reset}`);
  
  metrics.recordMemory('memory-test-start');
  
  // Test with increasing data sizes
  const dataSizes = [1, 10, 50, 100];
  
  for (const size of dataSizes) {
    console.log(`  Testing with ${size} search results`);
    
    // Override search to return specific number of results
    const originalSearch = adapter.main.env.smart_sources.search;
    adapter.main.env.smart_sources.search = async (query, opts) => {
      return Array(size).fill().map((_, i) => ({
        item: {
          path: `memory-test-${i}.md`,
          content: 'A'.repeat(1000) // 1KB per result
        }
      }));
    };
    
    metrics.recordMemory(`memory-before-${size}`);
    
    for (let i = 0; i < 10; i++) {
      await adapter.gather_context(`memory test ${size}-${i}`);
      await adapter.format_prompt([
        { role: 'user', content: `Memory test message ${size}-${i}` }
      ]);
    }
    
    metrics.recordMemory(`memory-after-${size}`);
    
    // Restore original search
    adapter.main.env.smart_sources.search = originalSearch;
  }
  
  metrics.recordMemory('memory-test-end');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    metrics.recordMemory('memory-after-gc');
  }
  
  console.log(`  ${colors.green}Memory Usage Results:${colors.reset}`);
  const memorySnapshots = metrics.memorySnapshots;
  const start = memorySnapshots.find(s => s.label === 'memory-test-start');
  const end = memorySnapshots.find(s => s.label === 'memory-test-end');
  
  if (start && end) {
    const growth = {
      heapUsed: (end.heapUsed - start.heapUsed) / 1024 / 1024,
      heapTotal: (end.heapTotal - start.heapTotal) / 1024 / 1024,
      rss: (end.rss - start.rss) / 1024 / 1024
    };
    
    console.log(`    Heap used growth: ${growth.heapUsed.toFixed(2)}MB`);
    console.log(`    Heap total growth: ${growth.heapTotal.toFixed(2)}MB`);
    console.log(`    RSS growth: ${growth.rss.toFixed(2)}MB`);
  }
}

/**
 * Test error handling performance
 */
async function testErrorHandling(adapter) {
  console.log(`\n${colors.cyan}Testing Error Handling Performance...${colors.reset}`);
  
  const errorScenarios = [
    {
      name: 'search-failure',
      setup: () => {
        const original = adapter.main.env.smart_sources.search;
        adapter.main.env.smart_sources.search = async () => {
          throw new Error('Simulated search failure');
        };
        return () => { adapter.main.env.smart_sources.search = original; };
      }
    },
    {
      name: 'missing-env',
      setup: () => {
        const originalEnv = adapter.main.env;
        adapter.main.env = null;
        return () => { adapter.main.env = originalEnv; };
      }
    },
    {
      name: 'invalid-messages',
      setup: () => null // No setup needed, will pass invalid data
    }
  ];
  
  for (const scenario of errorScenarios) {
    console.log(`  Testing ${scenario.name} error handling`);
    
    const cleanup = scenario.setup ? scenario.setup() : null;
    
    for (let i = 0; i < 10; i++) {
      try {
        metrics.startMeasure(`error-${scenario.name}`);
        
        if (scenario.name === 'invalid-messages') {
          await adapter.format_prompt([
            { role: 'invalid', content: null }, // Invalid message
            { content: 'missing role' }, // Missing role
            null // Null message
          ]);
        } else {
          await adapter.gather_context(`error test ${i}`);
        }
        
        metrics.endMeasure(`error-${scenario.name}`);
      } catch (error) {
        metrics.endMeasure(`error-${scenario.name}`);
        // Error expected - this tests how quickly errors are handled
      }
    }
    
    if (cleanup) cleanup();
    
    const stats = metrics.getStats(`error-${scenario.name}`);
    if (stats) {
      console.log(`    Mean response time: ${stats.mean.toFixed(2)}ms`);
    }
  }
}

/**
 * Run stress test
 */
async function runStressTest(adapter) {
  console.log(`\n${colors.red}${colors.bold}Running Stress Test...${colors.reset}`);
  console.log(`  This will push the system to its limits with high load`);
  
  const stressIterations = 200;
  const stressConcurrency = 20;
  
  metrics.recordMemory('stress-start');
  
  const startTime = Date.now();
  
  // Create high-concurrency stress test
  const stressTasks = Array(stressConcurrency).fill().map(async (_, workerIndex) => {
    for (let i = 0; i < stressIterations / stressConcurrency; i++) {
      try {
        metrics.startMeasure('stress-test');
        
        // Rapid-fire operations
        const promises = [
          adapter.gather_context(`stress test ${workerIndex}-${i}-context`),
          adapter.format_prompt([
            { role: 'user', content: `Stress test message ${workerIndex}-${i}` }
          ]),
          adapter.gather_context(`stress test ${workerIndex}-${i}-context-2`),
        ];
        
        await Promise.all(promises);
        metrics.endMeasure('stress-test');
        
        // No delay in stress test
      } catch (error) {
        metrics.recordError(error, `stress-worker-${workerIndex}-${i}`);
        metrics.endMeasure('stress-test');
      }
    }
  });
  
  await Promise.all(stressTasks);
  
  const stressTime = Date.now() - startTime;
  metrics.recordMemory('stress-end');
  
  console.log(`  ${colors.green}Stress Test Results:${colors.reset}`);
  console.log(`    Total time: ${stressTime}ms`);
  console.log(`    Operations attempted: ${stressIterations * 3}`); // 3 operations per iteration
  console.log(`    Errors: ${metrics.errors.length}`);
  
  const stressStats = metrics.getStats('stress-test');
  if (stressStats) {
    console.log(`    Mean operation time: ${stressStats.mean.toFixed(2)}ms`);
    console.log(`    95th percentile: ${stressStats.p95.toFixed(2)}ms`);
    console.log(`    Max operation time: ${stressStats.max.toFixed(2)}ms`);
  }
  
  const memoryDelta = metrics.getMemoryDelta();
  if (memoryDelta) {
    console.log(`    Memory growth: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
}

/**
 * Generate performance report
 */
function generateReport() {
  console.log(`\n${colors.bold}=== PERFORMANCE REPORT ===${colors.reset}`);
  
  const allMeasurements = Object.keys(metrics.measurements);
  console.log(`\n${colors.cyan}Summary of all measurements:${colors.reset}`);
  
  allMeasurements.forEach(name => {
    const stats = metrics.getStats(name);
    if (stats && stats.count > 0) {
      console.log(`  ${colors.yellow}${name}:${colors.reset}`);
      console.log(`    Count: ${stats.count}`);
      console.log(`    Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`    Median: ${stats.median.toFixed(2)}ms`);
      console.log(`    95th percentile: ${stats.p95.toFixed(2)}ms`);
      console.log(`    Range: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`);
    }
  });
  
  if (metrics.errors.length > 0) {
    console.log(`\n${colors.red}Errors encountered: ${metrics.errors.length}${colors.reset}`);
    const errorsByType = {};
    metrics.errors.forEach(error => {
      errorsByType[error.context] = (errorsByType[error.context] || 0) + 1;
    });
    
    Object.entries(errorsByType).forEach(([context, count]) => {
      console.log(`  ${context}: ${count} errors`);
    });
  }
  
  const memoryDelta = metrics.getMemoryDelta();
  if (memoryDelta) {
    console.log(`\n${colors.cyan}Overall memory usage:${colors.reset}`);
    console.log(`  Heap used: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  RSS: ${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Performance thresholds and recommendations
  console.log(`\n${colors.cyan}Performance Analysis:${colors.reset}`);
  
  const contextStats = metrics.getStats('context-gathering');
  if (contextStats) {
    if (contextStats.p95 < 100) {
      console.log(`  ${colors.green}✅ Context gathering: Excellent (95th percentile: ${contextStats.p95.toFixed(2)}ms)${colors.reset}`);
    } else if (contextStats.p95 < 500) {
      console.log(`  ${colors.yellow}⚠️  Context gathering: Acceptable (95th percentile: ${contextStats.p95.toFixed(2)}ms)${colors.reset}`);
    } else {
      console.log(`  ${colors.red}❌ Context gathering: Slow (95th percentile: ${contextStats.p95.toFixed(2)}ms)${colors.reset}`);
    }
  }
  
  const formatStats = metrics.getStats('prompt-formatting-10'); // Test with 10 messages
  if (formatStats) {
    if (formatStats.p95 < 50) {
      console.log(`  ${colors.green}✅ Prompt formatting: Excellent (95th percentile: ${formatStats.p95.toFixed(2)}ms)${colors.reset}`);
    } else if (formatStats.p95 < 200) {
      console.log(`  ${colors.yellow}⚠️  Prompt formatting: Acceptable (95th percentile: ${formatStats.p95.toFixed(2)}ms)${colors.reset}`);
    } else {
      console.log(`  ${colors.red}❌ Prompt formatting: Slow (95th percentile: ${formatStats.p95.toFixed(2)}ms)${colors.reset}`);
    }
  }
  
  if (memoryDelta && memoryDelta.heapUsed > 50 * 1024 * 1024) { // 50MB
    console.log(`  ${colors.red}❌ Memory usage: High growth detected (${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB)${colors.reset}`);
  } else if (memoryDelta) {
    console.log(`  ${colors.green}✅ Memory usage: Acceptable (${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB)${colors.reset}`);
  }
}

/**
 * Main performance test runner
 */
async function runPerformanceTests() {
  console.log(`${colors.bold}${colors.magenta}`);
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CLAUDE CODE CLI PERFORMANCE TESTER                       ║');
  console.log('║                                                                              ║');
  console.log('║   Comprehensive performance testing for Claude Code CLI integration         ║');
  console.log('║   Testing response times, throughput, memory usage, and stress scenarios    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Concurrent workers: ${concurrent}`);
  console.log(`  Stress test: ${stressTest ? 'Enabled' : 'Disabled'}`);
  console.log(`  Verbose output: ${verbose ? 'Enabled' : 'Disabled'}`);
  
  metrics.recordMemory('test-start');
  
  try {
    // Import the adapter
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    // Create test environment
    const mockModel = {
      config: {},
      env: createMockEnvironment()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    console.log(`\n${colors.green}✅ Adapter initialized successfully${colors.reset}`);
    
    // Run performance tests
    await testContextGathering(adapter);
    await testPromptFormatting(adapter);
    await testConcurrentProcessing(adapter);
    await testMemoryUsage(adapter);
    await testErrorHandling(adapter);
    
    if (stressTest) {
      await runStressTest(adapter);
    }
    
    metrics.recordMemory('test-end');
    
    generateReport();
    
  } catch (error) {
    console.error(`${colors.red}Performance test failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Performance test interrupted by user${colors.reset}`);
  generateReport();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught Exception:${colors.reset}`, error);
  generateReport();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled Rejection:${colors.reset}`, reason);
  generateReport();
  process.exit(1);
});

// Run the performance tests
runPerformanceTests().catch(error => {
  console.error(`${colors.red}Performance tester failed:${colors.reset}`, error);
  process.exit(1);
});