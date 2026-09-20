'use client';

import { FilterGroup, FilterRule } from '@/types';
import { Add, Close } from '@mui/icons-material';
import { Box, Button, Chip, MenuItem, Select, Stack, TextField } from '@mui/material';

const FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'statusCategory', label: 'Status category' },
  { value: 'category', label: 'Category' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title' },
];

const OPERATORS: Record<string, string[]> = {
  title: ['contains', 'is', 'is not'],
  priority: ['is', 'is not', 'is any of'],
  status: ['is', 'is not'],
  category: ['is', 'is not'],
  assignee: ['is', 'is empty', 'is not empty'],
  dueDate: ['before', 'after', 'today', 'this week', 'overdue'],
  statusCategory: ['is', 'is not'],
};

function isRule(item: FilterRule | FilterGroup): item is FilterRule {
  return 'field' in item;
}

export function FilterBar({
  value,
  onChange,
}: {
  value: FilterGroup;
  onChange: (next: FilterGroup) => void;
}) {
  const rules = value.rules.filter(isRule);

  function updateRule(index: number, patch: Partial<FilterRule>) {
    const next = rules.map((rule, current) => (current === index ? { ...rule, ...patch } : rule));
    onChange({ combinator: value.combinator, rules: next });
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Select
          size="small"
          value={value.combinator}
          onChange={(event) => onChange({ ...value, combinator: event.target.value as 'AND' | 'OR' })}
        >
          <MenuItem value="AND">Match all</MenuItem>
          <MenuItem value="OR">Match any</MenuItem>
        </Select>
        <Button
          startIcon={<Add />}
          onClick={() =>
            onChange({
              ...value,
              rules: [...rules, { field: 'priority', operator: 'is', value: 'HIGH' }],
            })
          }
        >
          Add filter
        </Button>
      </Stack>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {rules.map((rule, index) => (
          <Chip
            key={`${rule.field}-${index}`}
            variant="outlined"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Select
                  variant="standard"
                  disableUnderline
                  value={rule.field}
                  onChange={(event) => updateRule(index, { field: event.target.value, operator: 'is' })}
                >
                  {FIELDS.map((field) => (
                    <MenuItem key={field.value} value={field.value}>
                      {field.label}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  variant="standard"
                  disableUnderline
                  value={rule.operator}
                  onChange={(event) => updateRule(index, { operator: event.target.value })}
                >
                  {(OPERATORS[rule.field] ?? ['is']).map((operator) => (
                    <MenuItem key={operator} value={operator}>
                      {operator}
                    </MenuItem>
                  ))}
                </Select>
                {!['is empty', 'is not empty', 'today', 'this week', 'overdue'].includes(rule.operator) && (
                  <TextField
                    variant="standard"
                    value={String(rule.value ?? '')}
                    onChange={(event) => updateRule(index, { value: event.target.value })}
                    sx={{ width: 110 }}
                  />
                )}
              </Stack>
            }
            onDelete={() =>
              onChange({ combinator: value.combinator, rules: rules.filter((_, current) => current !== index) })
            }
            deleteIcon={<Close />}
          />
        ))}
      </Box>
    </Stack>
  );
}
