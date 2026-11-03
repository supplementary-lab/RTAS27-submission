# Fast Incremental Request-Bound Function Extraction

Interactive supplement, organized by the paper's evaluation experiments:

- [Synthetic workloads](https://supplementary-lab.github.io/RTAS27-submission/) (Sec. VII-B): generate job sequences and compare RBF extractors in an interactive notebook.
- [Time-sensitive network traffic](https://supplementary-lab.github.io/RTAS27-submission/network/) (Sec. VII-C, Fig. 10): inspect RBFs and bounds for MIRAGE 2022 Zoom connections.
- [Autoware autonomous driving stack](https://supplementary-lab.github.io/RTAS27-submission/autoware/) (Sec. VII-D, Fig. 11): compare RBFs and bounds for individual threads.
- [NATS online extraction](https://supplementary-lab.github.io/RTAS27-submission/nats/) (Sec. VII-E, Figs. 12–13): explore extraction CPU usage and per-thread RBFs at each message rate.

## Local hosting

From the repository root, serve the files with Python:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open any of the four pages:

- [Synthetic workloads](http://127.0.0.1:8000/)
- [Time-sensitive network traffic](http://127.0.0.1:8000/network/)
- [Autoware autonomous driving stack](http://127.0.0.1:8000/autoware/)
- [NATS online extraction](http://127.0.0.1:8000/nats/)