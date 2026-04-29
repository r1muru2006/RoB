#!/usr/bin/env python3
"""
Generate synthetic FSA API call logs, system call logs, and file system activity logs
for benign web apps and malicious RoB variants.

Based on Section 6.2 and Table 4 of the paper:
- 9 benign web apps (bangle, drawio, excalidraw, github, glitch, photopea, svgco, text-editor, vscode)
- 2 non-adaptive RoB configs (RoBEncOne, RoBEncHundred)
- 6 adaptive RoB configs (RoBReordered, RoBWithBenign, RoBWithBenAPI, RoBWithEncWait, RoBWithFSAWait, RoBBothWait)

Each log contains:
- fsa_calls: list of FSA API function call names
- syscalls: list of system call names
- fs_activities: list of file system event names
"""

import json
import random
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "sample_data"
random.seed(42)

FSA_FUNCTIONS = [
    "showDirectoryPicker", "showOpenFilePicker", "showSaveFilePicker",
    "getFile", "createWritable", "write", "close", "truncate", "seek",
    "getFileHandle", "getDirectoryHandle", "removeEntry", "resolve",
    "values", "keys", "entries",
]

SYSCALLS = [
    "read", "write", "open", "close", "stat", "fstat", "lstat",
    "poll", "lseek", "mmap", "mprotect", "munmap", "brk", "ioctl",
    "access", "pipe", "select", "sched_yield", "mremap", "madvise",
    "nanosleep", "getpid", "sendto", "recvfrom", "sendmsg", "recvmsg",
    "socket", "connect", "accept", "bind", "listen", "clone",
    "execve", "wait4", "kill", "uname", "fcntl", "flock",
    "fsync", "fdatasync", "rename", "unlink", "mkdir", "rmdir",
    "getcwd", "chdir", "chmod", "chown", "readlink", "getdents",
    "epoll_wait", "epoll_ctl", "timerfd_settime", "eventfd2",
    "futex", "clock_gettime", "getrandom",
]

FS_EVENTS = [
    "CREATE", "MODIFY", "DELETE", "MOVED_FROM", "MOVED_TO",
    "ATTRIB", "CLOSE_WRITE", "CLOSE_NOWRITE", "OPEN", "ACCESS",
]


def generate_benign_fsa(app_name, num_files=5):
    calls = []
    calls.append("showDirectoryPicker")
    calls.append("values")

    for _ in range(num_files):
        calls.append("getFileHandle")
        calls.append("getFile")

        num_edits = random.randint(2, 8)
        for _ in range(num_edits):
            calls.append("createWritable")
            for _ in range(random.randint(1, 3)):
                calls.append("write")
            if random.random() < 0.3:
                calls.append("seek")
            if random.random() < 0.2:
                calls.append("truncate")
            calls.append("close")
            calls.append("getFile")

        if random.random() < 0.3:
            calls.extend(["showSaveFilePicker", "createWritable", "write", "close"])
        if random.random() < 0.2:
            calls.extend(["getDirectoryHandle", "values"])

    return calls


def generate_benign_syscalls(app_name, num_files=5):
    calls = []
    for _ in range(num_files):
        calls.extend(["open", "read", "fstat"])
        num_ops = random.randint(5, 20)
        for _ in range(num_ops):
            calls.append(random.choice(["read", "write", "lseek", "fstat", "mmap",
                                        "poll", "epoll_wait", "futex", "clock_gettime",
                                        "recvmsg", "sendmsg"]))
        calls.extend(random.choices(["write", "fdatasync", "fsync", "close"], k=random.randint(2, 5)))
        calls.append("close")

        for _ in range(random.randint(2, 8)):
            calls.extend(["open", "read"])
            calls.extend(random.choices(["write", "lseek", "fstat"], k=random.randint(1, 4)))
            calls.extend(["fdatasync", "close"])
    return calls


def generate_benign_fs_activities(app_name, num_files=5):
    events = []
    for _ in range(num_files):
        events.append("OPEN")
        events.append("ACCESS")
        for _ in range(random.randint(2, 8)):
            events.append("MODIFY")
            events.append("CLOSE_WRITE")
            events.append("OPEN")
        events.append("CLOSE_NOWRITE")

        if random.random() < 0.3:
            events.extend(["CREATE", "MODIFY", "CLOSE_WRITE"])
        if random.random() < 0.1:
            events.append("DELETE")
    return events


def generate_rob_fsa(variant, num_files=100):
    calls = []
    calls.append("showDirectoryPicker")
    calls.append("values")

    file_ops = []
    for _ in range(num_files):
        ops = ["getFile", "createWritable", "write", "close"]
        file_ops.append(ops)

    if variant == "RoBEncOne":
        file_ops = file_ops[:1]
    elif variant == "RoBReordered":
        random.shuffle(file_ops)
    elif variant == "RoBWithBenign":
        new_ops = []
        for ops in file_ops:
            new_ops.append(ops)
            if random.random() < 0.3:
                new_ops.append(["getFile", "createWritable", "write", "write", "close"])
        file_ops = new_ops
    elif variant == "RoBWithBenAPI":
        new_ops = []
        for ops in file_ops:
            new_ops.append(ops)
            if random.random() < 0.3:
                new_ops.append([random.choice(["values", "keys", "entries", "resolve",
                                               "getDirectoryHandle", "getFileHandle"])])
        file_ops = new_ops

    for ops in file_ops:
        calls.extend(ops)

    return calls


def generate_rob_syscalls(variant, num_files=100):
    calls = []
    if variant == "RoBEncOne":
        num_files = 1

    for _ in range(num_files):
        calls.extend(["open", "read", "fstat"])
        calls.extend(["mmap", "read", "read", "read"])
        calls.extend(["write", "write", "write"])
        calls.extend(["fdatasync", "close"])

        if variant in ("RoBWithEncWait", "RoBBothWait"):
            calls.extend(random.choices(["nanosleep", "clock_gettime", "futex",
                                          "poll", "epoll_wait"], k=random.randint(3, 10)))

        if variant in ("RoBWithFSAWait", "RoBBothWait"):
            calls.extend(random.choices(["nanosleep", "clock_gettime", "sched_yield",
                                          "futex"], k=random.randint(2, 6)))
    return calls


def generate_rob_fs_activities(variant, num_files=100):
    events = []
    if variant == "RoBEncOne":
        num_files = 1

    for _ in range(num_files):
        events.extend(["OPEN", "ACCESS", "MODIFY", "CLOSE_WRITE"])
        events.extend(["CREATE", "MODIFY", "CLOSE_WRITE"])
        events.extend(["MOVED_FROM", "MOVED_TO"])
    return events


BENIGN_APPS = [
    "bangle", "drawio", "excalidraw", "github", "glitch",
    "photopea", "svgco", "text-editor", "vscode",
]

MALICIOUS_VARIANTS = [
    "RoBEncOne", "RoBEncHundred", "RoBReordered",
    "RoBWithBenign", "RoBWithBenAPI",
    "RoBWithEncWait", "RoBWithFSAWait", "RoBBothWait",
]


def main():
    benign_dir = OUTPUT_DIR / "benign"
    malicious_dir = OUTPUT_DIR / "malicious"
    benign_dir.mkdir(parents=True, exist_ok=True)
    malicious_dir.mkdir(parents=True, exist_ok=True)

    for app in BENIGN_APPS:
        num_files = random.randint(3, 10)
        data = {
            "app_name": app,
            "type": "benign",
            "fsa_calls": generate_benign_fsa(app, num_files),
            "syscalls": generate_benign_syscalls(app, num_files),
            "fs_activities": generate_benign_fs_activities(app, num_files),
        }
        path = benign_dir / f"{app}.json"
        path.write_text(json.dumps(data, indent=2))
        print(f"[+] Generated benign: {app} (FSA: {len(data['fsa_calls'])}, "
              f"Syscalls: {len(data['syscalls'])}, FS: {len(data['fs_activities'])})")

    for variant in MALICIOUS_VARIANTS:
        num_files = 1 if variant == "RoBEncOne" else 100
        data = {
            "app_name": variant,
            "type": "malicious",
            "fsa_calls": generate_rob_fsa(variant, num_files),
            "syscalls": generate_rob_syscalls(variant, num_files),
            "fs_activities": generate_rob_fs_activities(variant, num_files),
        }
        fname = variant.lower()
        for old, new in [("robenc", "rob_enc_"), ("robreordered", "rob_reordered"),
                         ("robwith", "rob_with_"), ("robboth", "rob_both_")]:
            fname = fname.replace(old, new)
        path = malicious_dir / f"{fname}.json"
        path.write_text(json.dumps(data, indent=2))
        print(f"[+] Generated malicious: {variant} (FSA: {len(data['fsa_calls'])}, "
              f"Syscalls: {len(data['syscalls'])}, FS: {len(data['fs_activities'])})")

    print(f"\n[+] Total: {len(BENIGN_APPS)} benign + {len(MALICIOUS_VARIANTS)} malicious samples")


if __name__ == "__main__":
    main()
