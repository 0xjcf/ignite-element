---
"ignite-element": minor
"@ignite-element/adapters": minor
---

Remove the beta `cleanup` source-configuration option. Explicit values (including false and undefined) now throw before source acquisition. Shared cores retain application-level observation and activated effects across zero-consumer intervals until terminal disposal. Independent custom-element teardown and borrowed native-source ownership are unchanged.
