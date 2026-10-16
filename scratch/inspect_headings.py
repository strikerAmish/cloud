with open('master_clean.txt', encoding='utf-8') as f:
    master = f.read()

with open('rail_ai_clean.txt', encoding='utf-8') as f:
    rail_ai = f.read()

print("Master length:", len(master))
print("Rail AI length:", len(rail_ai))

# Look for sections, titles, checklists, or steps in master
import re
print("\n--- MASTER HEADINGS ---")
for line in master.split('\n'):
    line_s = line.strip()
    if any(line_s.startswith(p) for p in ['#', 'Step', 'Section', 'SECTION', 'Rubric', 'Phase', 'Screen', 'Part', 'PART']):
        if len(line_s) < 100:
            print(line_s)
