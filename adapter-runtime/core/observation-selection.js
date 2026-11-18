'use strict';

function maaObservationTasks(input, tasks, prefix) {
  if (input.selectedTaskIds === undefined) return tasks;
  const ids = input.selectedTaskIds;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length ||
      ids.some(id => !tasks.some(task => task.taskId === id && task.isSelected && task.isEnabled)))
    throw new Error(prefix + '_observation_selection_unbound');
  return tasks.map(task => ({ ...task, isSelected: task.isSelected && ids.includes(task.taskId) }));
}
