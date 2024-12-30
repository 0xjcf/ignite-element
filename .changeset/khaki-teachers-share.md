---
"ignite-element": minor
---

### Features
- **Decorators for Reactive Components**: Added `Shared` and `Isolated` decorators to enable reactive, class-based components with support for XState, Redux, and MobX.  
- **DOM Event Handling**: Enhanced the `send` method to support DOM events, improving interoperability and enabling dynamic updates.  
- **Gradient Tally Example**: Added an example showcasing dynamic rendering with gradient tally effects using lit-html.  

### Improvements
- **Initialization Guard**: Moved `_initialized` flag handling to `IgniteElement` for better DOM readiness and SSR support.  
- **Redux Adapter Enhancements**: Added type-safe dispatch and dynamic state management for slices and stores.  
- **Test Enhancements**: Suppressed console warnings and errors during test runs for cleaner output.  
- **CI/CD Integration**: Added **Codecov** integration with 80% coverage enforcement and reporting.  

### Documentation
- Updated README to explain web standards leveraged by `ignite-element` and added links to official documentation for reference.
