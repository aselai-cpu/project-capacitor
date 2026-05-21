# Useful SQL Queries

Reference queries for the Capacitor database. Run in pgAdmin (**Tools → Query Tool**) at http://localhost:5050 or via `psql`.

## Prisma Implicit Join Tables

Prisma's implicit many-to-many creates join tables named `_ModelAToModelB` with columns `A` and `B` (alphabetical by model name).

| Join Table | Column A | Column B |
|-----------|----------|----------|
| `_DeveloperToSkill` | developer.id | skill.id |
| `_SkillToTask` | skill.id | task.id |

---

## Developers

### All developers with their skills

```sql
SELECT d.name AS developer, s.name AS skill
FROM developers d
JOIN "_DeveloperToSkill" ds ON ds."A" = d.id
JOIN skills s ON ds."B" = s.id
ORDER BY d.name;
```

### Developers with skills grouped

```sql
SELECT d.name AS developer,
       STRING_AGG(s.name, ', ' ORDER BY s.name) AS skills
FROM developers d
JOIN "_DeveloperToSkill" ds ON ds."A" = d.id
JOIN skills s ON ds."B" = s.id
GROUP BY d.name
ORDER BY d.name;
```

### Developer workload (tasks assigned)

```sql
SELECT d.name AS developer,
       COUNT(t.id) AS assigned_tasks,
       STRING_AGG(t.title, '; ' ORDER BY t.created_at) AS task_titles
FROM developers d
LEFT JOIN tasks t ON t.developer_id = d.id
GROUP BY d.name
ORDER BY assigned_tasks DESC;
```

---

## Tasks

### All tasks with skills and assignee

```sql
SELECT t.title,
       t.status,
       d.name AS assignee,
       STRING_AGG(s.name, ', ' ORDER BY s.name) AS required_skills
FROM tasks t
LEFT JOIN developers d ON t.developer_id = d.id
LEFT JOIN "_SkillToTask" st ON st."B" = t.id
LEFT JOIN skills s ON st."A" = s.id
GROUP BY t.id, t.title, t.status, d.name
ORDER BY t.created_at;
```

### Task tree (parent → subtask hierarchy)

```sql
WITH RECURSIVE task_tree AS (
  SELECT id, title, status, parent_id, 0 AS depth,
         title AS path
  FROM tasks
  WHERE parent_id IS NULL
  UNION ALL
  SELECT t.id, t.title, t.status, t.parent_id, tt.depth + 1,
         tt.path || ' → ' || t.title
  FROM tasks t
  JOIN task_tree tt ON t.parent_id = tt.id
)
SELECT REPEAT('  ', depth) || title AS task,
       status,
       depth
FROM task_tree
ORDER BY path;
```

### Tasks with pending subtasks (blocked from Done)

```sql
SELECT parent.title AS parent_task,
       parent.status AS parent_status,
       COUNT(child.id) AS pending_subtasks
FROM tasks parent
JOIN tasks child ON child.parent_id = parent.id AND child.status != 'Done'
GROUP BY parent.id, parent.title, parent.status
ORDER BY pending_subtasks DESC;
```

### Unassigned tasks

```sql
SELECT t.title, t.status,
       STRING_AGG(s.name, ', ') AS required_skills
FROM tasks t
LEFT JOIN "_SkillToTask" st ON st."B" = t.id
LEFT JOIN skills s ON st."A" = s.id
WHERE t.developer_id IS NULL
GROUP BY t.id, t.title, t.status;
```

---

## Skills

### Skill demand (how many tasks require each skill)

```sql
SELECT s.name AS skill,
       COUNT(st."B") AS task_count
FROM skills s
LEFT JOIN "_SkillToTask" st ON st."A" = s.id
GROUP BY s.name
ORDER BY task_count DESC;
```

### Skill supply vs demand

```sql
SELECT s.name AS skill,
       COUNT(DISTINCT ds."A") AS developers_with_skill,
       COUNT(DISTINCT st."B") AS tasks_requiring_skill
FROM skills s
LEFT JOIN "_DeveloperToSkill" ds ON ds."B" = s.id
LEFT JOIN "_SkillToTask" st ON st."A" = s.id
GROUP BY s.name;
```

---

## Assignment Validation

### Eligible developers for a specific task

```sql
-- Replace 'task-uuid-here' with an actual task ID
SELECT d.name AS eligible_developer
FROM developers d
WHERE NOT EXISTS (
  SELECT 1 FROM "_SkillToTask" st
  WHERE st."B" = 'task-uuid-here'
  AND NOT EXISTS (
    SELECT 1 FROM "_DeveloperToSkill" ds
    WHERE ds."A" = d.id AND ds."B" = st."A"
  )
);
```

### Invalid assignments (developers lacking required skills)

```sql
SELECT d.name AS developer, t.title AS task,
       STRING_AGG(DISTINCT s.name, ', ') AS missing_skills
FROM tasks t
JOIN developers d ON t.developer_id = d.id
JOIN "_SkillToTask" st ON st."B" = t.id
JOIN skills s ON st."A" = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM "_DeveloperToSkill" ds
  WHERE ds."A" = d.id AND ds."B" = s.id
)
GROUP BY d.name, t.title;
```
