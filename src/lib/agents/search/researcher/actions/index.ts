import academicSearchAction from './academicSearch';
import doneAction from './done';
import planAction from './plan';
import ActionRegistry from './registry';
import scrapeURLAction from './scrapeURL';
import socialSearchAction from './socialSearch';
import uploadsSearchAction from './uploadsSearch';
import webSearchAction from './webSearch';
import { loadMCPActions } from './mcpAction';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(scrapeURLAction);
ActionRegistry.register(uploadsSearchAction);
ActionRegistry.register(academicSearchAction);
ActionRegistry.register(socialSearchAction);

/**
 * MCP actions are loaded asynchronously at startup. The registry exposes
 * a ready promise so callers can await full registration when needed.
 */
ActionRegistry.setReadyPromise(
  loadMCPActions().then((actions) => {
    actions.forEach((action) => ActionRegistry.register(action));
  }),
);

export { ActionRegistry };
