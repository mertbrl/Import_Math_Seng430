# HEALTH-AI ML Learning Tool - Frontend Architecture

This document provides a comprehensive, professional breakdown of the HEALTH-AI ML Learning Tool frontend architecture. It serves as a study guide for code reviews and architectural presentations.

## 📁 Src Folder Structure

The application is structured hierarchically by feature concern.

```text
src/
├── components/
│   ├── AppLayout.tsx
│   ├── HelpChatbotDrawer.tsx
│   ├── Step1_ClinicalContext.tsx
│   ├── Step1_ClinicalContext.test.tsx
│   └── TopNavbar.tsx
├── config/
│   └── domainConfig.ts
├── store/
│   └── useDomainStore.ts
├── App.jsx
├── index.css
├── main.jsx
└── vitest.setup.ts
```

---

## 🧱 File Breakdown by Architectural Layer

### 1. The Data / Configuration Layer
**`src/config/domainConfig.ts`**
- **Purpose:** This file acts as our "single source of truth" for the application's entire clinical dataset schema. It contains the exact 20 medical domains mapped to a strict TypeScript interface `DomainConfig`.
- **Contents:** Arrays of objects containing `domainName`, `clinicalQuestion`, `dataSource`, `targetVariable`, and customized `whyThisMatters` strings.

### 2. The Global State Layer
**`src/store/useDomainStore.ts`**
- **Purpose:** This file manages the memory and reactive state of the application across all components globally using Zustand.
- **Contents:** It holds our active `selectedDomainId`, tracks whether the assistance drawer `isHelpOpen`, and exposes predictable mutation functions (`setDomain`, `toggleHelp`, `resetApp`).

### 3. The Presentation / UI Layer
**`src/components/TopNavbar.tsx`**
- **Purpose:** A purely presentational shell layer living at the absolute top of the DOM. It provides static brand identity and houses the global application controls (Reset and Help buttons) as well as an active domain pill.

**`src/components/AppLayout.tsx`**
- **Purpose:** This is the primary structural wrapper (or "Layout Slot"). It imports the `TopNavbar`, renders the sticky Horizontal Domain Selector Bar containing our 20 domain chips, renders the 7-Step Stepper visual widget, and conditionally renders our child sub-components (like Step 1) directly beneath it.

**`src/components/HelpChatbotDrawer.tsx`**
- **Purpose:** The global slide-over drawer operating on z-index precedence. It acts as an interactive UI overlay communicating with the user. It houses its own internal local state for tracking message arrays and manages a simulated ML dictionary lookup before displaying it.

**`src/components/Step1_ClinicalContext.tsx`**
- **Purpose:** The specific view for Step 1. It acts as a passive consumer of the `useDomainStore`. Whenever the store's `selectedDomainId` updates, this component reactively fetches the corresponding data from `domainConfig.ts` and instantly paints the domain's unique text into its rigid 2-column CSS grid.

**`src/components/Step1_ClinicalContext.test.tsx`**
- **Purpose:** The Vitest testing suite. It ensures visual regression safety by programmatically looping through the 20 domains in `domainConfig.ts`, forcefully overriding the Zustand store state, and asserting that the DOM accurately swaps out the text.

---

## 📐 Architectural Decisions & Justifications

### Why evaluate Zustand over Context API or Redux?
We chose Zustand because it sits perfectly in the "Goldilocks zone" for this project.
- **Versus Redux:** Redux mandates heavy boilerplate (actions, reducers, dispatchers). For an application primarily tracking string IDs and booleans, Redux is architectural overkill.
- **Versus Context API:** React's native Context API triggers full re-renders of the entire provider tree whenever a value changes. Zustand utilizes optimized hook-based subscriptions outside of the React render cycle. This means when a user clicks a new Domain, only components explicitly reading that exact state value (like Step 1) will re-render, keeping the UI lightning fast—which is crucial when scrolling a massive horizontal domain bar.

### Why extract the 20 domains into `domainConfig.ts`?
Hardcoding text directly inside UI components (`Step1_ClinicalContext.tsx`) violates maintainability rules. By physically extracting the data into an independent configuration file, we built a highly scalable system:
- It allows our UI components to be completely "dumb" and purely presentational schemas.
- If a clinician requests a 21st domain, or a typo fix in "Cardiology", we simply modify the configuration array. The UI does not need to be touched, risk-tested, or fundamentally altered.

### How does this architecture adhere to SOLID principles?
Our architecture heavily adheres to the **Single Responsibility Principle (SRP)** and the **Separation of Concerns**.

1. **State Isolation:** `useDomainStore.ts` does not know how buttons look. It only cares about memory data.
2. **Data Isolation:** `domainConfig.ts` does not know about React. It only cares about TypeScript structuring.
3. **UI Isolation:** `AppLayout.tsx` doesn't know what "Step 1" is doing mathematically. It only cares about rendering the wrapper shell. `Step1_ClinicalContext.tsx` doesn't know *how* `useDomainStore` updates the selected ID; it just blindly renders whatever ID it receives.

Because each conceptual piece of the application has been distinctly isolated into its own folder boundary, bugs encountered in state logic cannot accidentally ripple into CSS UI breakage, keeping the repository safe, easily readable, and highly testable.

---

## 🛠 Technical Stack & Tooling

To execute this architecture efficiently, we carefully selected a modern, industry-standard technology stack:

- **React 18:** The core UI library used to build our component-driven architecture.
- **TypeScript:** Enforces strict typing (like our `DomainConfig` interface) to catch errors at compile-time rather than runtime, serving as a critical safety net for medical terminology data structures.
- **Tailwind CSS (v4):** Replaces legacy BEM CSS. We use Tailwind to rapidly build soft, modern, premium UI components purely via utility classes directly in the markup, avoiding spaghetti global stylesheets.
- **Zustand:** A tiny, incredibly fast state-management tool that replaces bulky Redux or re-render-heavy Context APIs. It allows our UI components to selectively subscribe to global data.
- **Vite:** Our ultra-fast build tool and development server, replacing older architectures like Webpack. It natively understands ES modules and hot-reloads our React components instantly.
- **Vitest & React Testing Library:** Replaces Jest for a faster testing experience integrated with Vite. We use these tools to enforce 100% loop coverage on our domain configurations, simulating DOM interactions without a physical browser.
