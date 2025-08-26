# Feature Development Workflow

## Overview
Standard workflow for developing new features in Smart Connections using Agent OS.

## Prerequisites
- Agent OS installed and configured
- Development environment set up
- Understanding of JSBrains architecture

## Workflow Steps

### 1. Create Feature Specification
```bash
# Use Agent OS to create spec
/create-spec

# Or manually create from template
cp .agent-os/templates/spec-template.md .agent-os/specs/[feature-name]/srd.md
```

### 2. Review and Refine Spec
- Ensure requirements are clear
- Validate technical approach
- Consider privacy implications
- Check performance requirements

### 3. Create Task Breakdown
```bash
# Use Agent OS for task generation
/create-tasks

# Tasks will be created in .agent-os/tasks/[feature-name]/
```

### 4. Execute Implementation
```bash
# Use Agent OS TDD approach
/execute-tasks

# Or implement manually following the task list
```

### 5. Testing Process

#### Run Existing Tests
```bash
# All tests
npm test

# Feature-specific tests
npx ava src/[feature]/*.test.js

# Claude Code tests if applicable
npm run test:claude
```

#### Add New Tests
Create test files following the pattern:
```javascript
// src/features/my_feature.test.js
import test from 'ava';
import { MyFeature } from './my_feature.js';

test('feature behaves correctly', async t => {
  const feature = new MyFeature();
  const result = await feature.process(input);
  t.is(result, expected);
});
```

### 6. Integration Testing

#### Manual Testing
1. Build the plugin: `npm run build`
2. Copy to test vault
3. Test all scenarios
4. Check for regressions

#### Performance Testing
```bash
# Run performance tests
npm run perf:claude

# Profile with Chrome DevTools
# 1. Open Obsidian Developer Console
# 2. Use Performance tab
# 3. Record during feature use
```

### 7. Documentation Updates

#### Update User Documentation
- Update README.md if needed
- Add feature to CHANGELOG
- Create user guide if complex

#### Update Technical Documentation
- Update architecture.md if structural changes
- Update development-guide.md for new patterns
- Document in .agent-os/product/

### 8. Code Review Checklist

Before submitting:
- [ ] Code follows javascript-style.md
- [ ] Best practices applied
- [ ] Tests written and passing
- [ ] Performance acceptable
- [ ] Privacy preserved
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling complete

### 9. Git Workflow

```bash
# Create feature branch
git checkout -b feature/[feature-name]

# Make commits following convention
git commit -m "feat: Add [feature description]"

# Common prefixes:
# feat: New feature
# fix: Bug fix
# docs: Documentation
# test: Test addition
# refactor: Code refactoring
# perf: Performance improvement

# Push and create PR
git push origin feature/[feature-name]
```

## Common Patterns

### Adding a New Component
1. Create component in `src/components/`
2. Follow render function pattern
3. Register in `smart_env.config.js`
4. Add to appropriate view

### Adding a New Adapter
1. Create adapter in `src/adapters/`
2. Extend appropriate base class
3. Register in configuration
4. Add settings UI if needed

### Adding a New Collection
1. Define entity class
2. Configure collection
3. Set up data adapter
4. Implement required methods

## Troubleshooting

### Build Issues
```bash
# Clear and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Test Failures
```bash
# Run specific test with verbose output
npx ava src/specific.test.js --verbose

# Debug with console output
DEBUG=* npx ava src/specific.test.js
```

### Runtime Errors
1. Check Obsidian Developer Console
2. Look for SmartEnv initialization issues
3. Verify collections are loaded
4. Check for missing dependencies

## Tips for Success

### Performance
- Profile before optimizing
- Test with large vaults (1000+ notes)
- Use debouncing for file events
- Implement progressive loading

### Privacy
- Never send data externally without consent
- Use local processing when possible
- Clear sensitive data from logs
- Document any external calls

### User Experience
- Provide clear feedback
- Handle errors gracefully
- Make features discoverable
- Respect user preferences

---

*This workflow ensures consistent, high-quality feature development for Smart Connections.*