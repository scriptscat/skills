# Cron Expression Cheatsheet

## Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, both 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

## Common Examples

| Expression | Meaning |
|------------|---------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour on the hour |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * *` | Daily at 09:00 |
| `0 9,18 * * *` | Daily at 09:00 and 18:00 |
| `0 9 * * 1-5` | Weekdays at 09:00 |
| `0 9 * * 0,6` | Weekends at 09:00 |
| `0 0 * * *` | Daily at midnight |
| `0 0 1 * *` | 1st of every month at midnight |
| `0 0 1 1 *` | January 1st every year |

## Special Characters

- `*` — any value
- `,` — list: `1,3,5`
- `-` — range: `1-5` (Monday to Friday)
- `/` — step: `*/10` (every 10 units)
