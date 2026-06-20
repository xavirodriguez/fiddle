# -*- coding: utf-8 -*-

import os


FILES = [
    ".ai/README.md",
    ".ai/PROJECT_STATE.md",
    ".ai/ARCHITECTURE.md",
    ".ai/DECISIONS.md",

    ".ai/tasks/TODO.md",
    ".ai/tasks/IN_PROGRESS.md",
    ".ai/tasks/DONE.md",
    ".ai/tasks/BLOCKED.md",

    ".ai/experiments/SUCCESS.md",
    ".ai/experiments/FAILED.md",

    ".ai/bugs/OPEN.md",
    ".ai/bugs/RESOLVED.md",

    ".ai/knowledge/STACK.md",
    ".ai/knowledge/PATTERNS.md",
    ".ai/knowledge/GOTCHAS.md",
    ".ai/knowledge/GLOSSARY.md",

    ".ai/agents/ROLES.md",
    ".ai/agents/RULES.md",
    ".ai/agents/HANDOFF.md",

    ".ai/logs/CHANGELOG.md",
    ".ai/logs/SESSIONS.md"
]


CONTENT = """# AI Project Memory

Este archivo forma parte de la memoria del proyecto.

Actualizarlo cuando cambie el estado del proyecto.
"""


def create_structure():

    for file_path in FILES:

        directory = os.path.dirname(file_path)

        if not os.path.exists(directory):
            os.makedirs(directory)

        if not os.path.exists(file_path):
            with open(file_path, "w") as f:
                f.write(CONTENT)

            print("Creado:", file_path)

        else:
            print("Existe:", file_path)


if __name__ == "__main__":
    create_structure()

    print("")
    print("Memoria IA creada correctamente")