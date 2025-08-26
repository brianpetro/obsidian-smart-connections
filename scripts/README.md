# Claude Code CLI Integration Validation Scripts

This directory contains comprehensive validation and testing scripts for the Claude Code CLI integration in Smart Connections.

## 📋 Overview

The validation suite ensures that the Claude Code CLI integration works correctly end-to-end, from chat interface to CLI execution. It includes unit tests, integration tests, performance testing, and end-to-end validation.

## 🧪 Test Scripts

### 1. `validate_claude_integration.js`
**Main validation script** - Performs comprehensive system validation

```bash
# Full validation suite
npm run validate:claude

# Check only CLI availability (fast)
npm run validate:claude-cli-only

# With verbose output
node scripts/validate_claude_integration.js --verbose
```

**What it tests:**
- ✅ Installation validation (package.json, adapter files, config)
- ✅ Claude CLI availability and version
- ✅ Configuration validation (adapter registration, settings)
- ✅ Adapter functionality (methods, properties, initialization)
- ✅ Integration tests execution
- ✅ End-to-end validation

### 2. `performance_test_claude.js`
**Performance testing script** - Measures response times and resource usage

```bash
# Standard performance test
npm run perf:claude

# Stress test with high load
npm run perf:claude-stress

# Custom parameters
node scripts/performance_test_claude.js --iterations 100 --concurrent 10 --verbose
```

**What it measures:**
- 📊 Context gathering performance
- 📊 Prompt formatting speed
- 📊 Concurrent processing throughput
- 📊 Memory usage patterns
- 📊 Error handling performance
- 📊 Stress test scenarios

### 3. `e2e_claude_test.js`
**End-to-end integration test** - Simulates real user workflows

```bash
# Mock E2E testing
npm run e2e:claude

# Test with real CLI (requires Claude CLI installed)
npm run e2e:claude-real

# Test error scenarios
npm run e2e:claude-failures

# With verbose output
node scripts/e2e_claude_test.js --verbose
```

**What it validates:**
- 🔄 Complete chat flow from interface to response
- 🔄 Context gathering with semantic search
- 🔄 Prompt formatting with conversation history
- 🔄 Streaming and non-streaming completions
- 🔄 Error handling and retry logic
- 🔄 Real CLI communication (when enabled)

## 🏃 Quick Start

### Run All Validations
```bash
# Essential validation (recommended first step)
npm run validate:claude

# Unit tests for adapter
npm run test:claude

# Integration tests
npm run test:claude-integration

# Performance testing
npm run perf:claude

# End-to-end validation
npm run e2e:claude
```

### Check Claude CLI Only
```bash
# Quick CLI availability check
npm run validate:claude-cli-only
```

### Test With Real CLI
```bash
# First ensure CLI is installed and in PATH
claude --version

# Then run real integration test
npm run e2e:claude-real
```

## 🎯 Test Categories

### Unit Tests
Located in `src/adapters/claude_code_cli_adapter.test.js`
- Individual method testing
- Mock-based validation
- Edge case handling

### Integration Tests  
Located in `src/test/claude_code_integration.test.js`
- Component interaction testing
- Configuration validation
- Performance benchmarking

### Validation Scripts
Located in `scripts/`
- System-wide validation
- Installation verification
- Real-world scenario testing

## 📊 Expected Results

### ✅ Success Indicators
- All validation steps pass
- Response times < 200ms (p95)
- Memory growth < 10MB per operation
- Error rate < 0.1%
- Real CLI communication works (if installed)

### ⚠️ Warning Indicators
- Claude CLI not installed (expected if not set up)
- Some performance metrics slightly elevated
- Non-critical configuration issues

### ❌ Failure Indicators
- Adapter import/initialization failures
- Configuration errors
- Broken method implementations
- Memory leaks or excessive resource usage

## 🔧 Troubleshooting

### Claude CLI Not Found
```bash
# Install Claude CLI first
# See: https://docs.anthropic.com/claude/docs/claude-cli

# Verify installation
claude --version

# Check PATH
which claude
```

### Test Failures
```bash
# Run with verbose output for debugging
node scripts/validate_claude_integration.js --verbose

# Test specific components
npm run test:claude
npm run test:claude-integration

# Check individual methods
node -e "
import('./src/adapters/claude_code_cli_adapter.js')
  .then(m => console.log(Object.getOwnPropertyNames(m.ClaudeCodeCLIAdapter.prototype)))
"
```

### Performance Issues
```bash
# Run performance analysis
npm run perf:claude --verbose

# Check memory usage
node --expose-gc scripts/performance_test_claude.js

# Profile with lower iterations
node scripts/performance_test_claude.js --iterations 10 --verbose
```

## 📝 Test Configuration

### Environment Variables
```bash
# Enable garbage collection for memory testing
node --expose-gc scripts/performance_test_claude.js

# Debug mode
DEBUG=* npm run validate:claude
```

### Test Data
All test scripts use realistic mock data:
- Sample Obsidian vault structure
- Realistic note content and relationships  
- Simulated semantic search results
- Mock conversation histories

### CLI Simulation
When testing without real CLI:
- Mock process execution
- Simulated response times
- Controlled error scenarios
- Predictable test data

## 🚀 Continuous Integration

### Pre-commit Validation
```bash
# Add to pre-commit hooks
npm run validate:claude && npm run test:claude
```

### Build Pipeline
```bash
# Full test suite for CI
npm test && npm run validate:claude && npm run e2e:claude
```

### Release Validation
```bash
# Complete validation before release
npm run validate:claude &&
npm run perf:claude &&
npm run e2e:claude &&
npm run test:claude-integration
```

## 📈 Performance Benchmarks

### Target Metrics
- **Context Gathering**: < 100ms (95th percentile)
- **Prompt Formatting**: < 50ms (95th percentile)  
- **Memory Usage**: < 50MB growth per session
- **Concurrent Processing**: > 10 ops/sec
- **Error Recovery**: < 1 second retry cycle

### Monitoring
The performance tests provide detailed metrics:
- Response time distributions
- Memory usage patterns
- Throughput measurements
- Error rate analysis
- Resource utilization

## 🔍 Debugging Features

### Verbose Output
All scripts support `--verbose` flag for detailed information:
- Step-by-step execution logs
- Data samples and previews
- Timing information
- Memory snapshots

### Mock Controls
- Simulate failures: `--simulate-failures`
- Real CLI testing: `--with-real-cli`
- Custom iterations: `--iterations N`
- Concurrency control: `--concurrent N`

### Error Scenarios
Comprehensive error testing:
- CLI not available
- Search failures
- Network timeouts
- Invalid configurations
- Resource exhaustion

---

## 📚 Additional Resources

- [Claude Code CLI Documentation](https://docs.anthropic.com/claude/docs/claude-cli)
- [Smart Connections Architecture](../CLAUDE.md)
- [Integration Examples](../src/adapters/claude_code_cli_adapter_example.js)
- [Configuration Guide](../src/smart_env.config.js)

## 🤝 Contributing

When adding new validation tests:
1. Follow existing patterns in test files
2. Include both success and failure scenarios
3. Add performance benchmarks where relevant
4. Update this README with new test descriptions
5. Ensure tests work both with and without real CLI

---

*These validation scripts ensure the Claude Code CLI integration maintains high quality and reliability across all usage scenarios.*