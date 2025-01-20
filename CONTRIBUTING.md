# Contributing

Contributions to Ignite-Element are welcome and encouraged! Whether you're fixing bugs, adding new features, or improving documentation, your efforts help improve Ignite-Element for everyone.

---

## **How to Contribute**

1. **Fork the Repository**  
   Start by forking the Ignite-Element repository to your GitHub account.

2. **Clone Your Fork**  
   Clone your fork to your local machine:

   ```bash
   git clone https://github.com/<your-username>/ignite-element.git
   cd ignite-element
   ```

3. **Install Dependencies**  
   Install the required dependencies:
   `pnpm install`

4. **Run Examples**  
   Examples for **XState**, **Redux**, and **MobX** are located in the `src/examples` directory. To start the server for each example, use the following commands:

   - **XState**:
     `pnpm run examples:xstate`

   - **Redux**:
     `pnpm run examples:redux`

   - **MobX**:
     `pnpm run examples:mobx`

5. **Create a Feature Branch**  
   Create a new branch for your feature or bug fix:
   `git checkout -b feature/my-new-feature`

6. **Write Clear Commits**  
   Commit your changes with clear and descriptive commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps maintain a clean commit history and automates release notes. For example:

   - `feat: add new decorator for isolated components`
   - `fix: correct rendering logic for shared components`
   - `docs: update contributing guidelines`

   Commit your changes:
   `git commit -m "feat: add new feature for tab navigation"`

7. **Write Tests**  
   Ensure tests cover your changes. We maintain an acceptable code coverage of **80% or higher**, and tests are in place for most of the codebase:
   `pnpm test`

8. **Push Your Changes**  
   Push your branch to your forked repository:
   `git push origin feature/my-new-feature`

9. **Open a Pull Request**  
    Go to the original Ignite-Element repository and open a pull request. Include a clear description of your changes and any relevant issue numbers.

---

## **Development Guidelines**

#### Code Style

Follow the existing code style and conventions. Use the following command to check for linting errors:
`pnpm run lint`

#### Testing

Add or update tests for your changes. Run the test suite locally to ensure all tests pass:
`pnpm test`

#### Code Coverage

Maintain a minimum of **80% test coverage** for all contributions. Run the coverage report:
`pnpm run test:coverage`

#### Documentation

Update documentation for new features or changes to existing functionality.

#### Atomic Commits

Keep commits small and focused. Group related changes together.

#### Stay Up-to-Date

Sync your fork with the main repository regularly:

```bash
git checkout main
git pull upstream main
git push origin main
```

---

## **Ways to Contribute**

1. **Report Bugs**  
   Found a bug? Open an issue with detailed steps to reproduce the problem.

2. **Suggest Features**  
   Have an idea for a new feature? Share it by opening an issue or starting a discussion.

3. **Fix Issues**  
   Browse open issues to find something you'd like to work on.

4. **Improve Documentation**  
   Help keep the documentation clear, concise, and up-to-date.

5. **Write Tests**  
   Add or improve tests to ensure code reliability and meet the coverage standard.

---

## **Thank You for Contributing!**

Your contributions help Ignite-Element grow and improve. We're grateful for your time and effort!
