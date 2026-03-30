import { GridSearchConfig, ModelId, ModelParamsById } from '../../../store/useModelStore';

export interface SearchFieldDefinition {
  param: string;
  label: string;
  example: string;
  inputHint: string;
  helperText: string;
  defaultExpression: (params: Record<string, unknown>) => string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function serializeCurrentValue(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return Number(value.toPrecision(6)).toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value ?? '');
}

function uniqueNumbers(values: number[], digits = 4): string {
  const seen = new Set<string>();
  return values
    .map((value) => Number(value.toFixed(digits)))
    .filter((value) => {
      const key = String(value);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');
}

function centeredInts(current: number, step: number, minimum: number, maximum: number): string {
  return uniqueNumbers([
    clamp(current - step, minimum, maximum),
    clamp(current, minimum, maximum),
    clamp(current + step, minimum, maximum),
  ]);
}

function centeredFloats(current: number, multipliers: number[], minimum: number, maximum: number): string {
  return uniqueNumbers(multipliers.map((multiplier) => clamp(current * multiplier, minimum, maximum)));
}

export const MODEL_SEARCH_FIELDS: Record<ModelId, SearchFieldDefinition[]> = {
  knn: [
    {
      param: 'k',
      label: 'K Neighbors',
      example: '3, 5, 7',
      inputHint: 'Use comma values or a numeric range like 3:9:2.',
      helperText: 'Bigger K smooths more. Smaller K reacts more locally.',
      defaultExpression: (params) => centeredInts(Number(params.k ?? 5), 2, 1, 50),
    },
    {
      param: 'weights',
      label: 'Voting Strategy',
      example: 'uniform, distance',
      inputHint: 'List the candidate modes separated by commas.',
      helperText: 'Distance weighting can rescue local minority patterns.',
      defaultExpression: () => 'uniform, distance',
    },
    {
      param: 'p',
      label: 'Distance Metric',
      example: '1, 2',
      inputHint: 'Choose from the allowed values only.',
      helperText: '1 is Manhattan, 2 is Euclidean.',
      defaultExpression: () => '1, 2',
    },
  ],
  svm: [
    {
      param: 'c',
      label: 'C',
      example: '0.5, 1, 2',
      inputHint: 'Try comma values or a range like 0.25:2:0.25.',
      helperText: 'Higher C fits training errors more aggressively.',
      defaultExpression: (params) => centeredFloats(Number(params.c ?? 1), [0.5, 1, 2], 0.01, 100),
    },
    {
      param: 'kernel',
      label: 'Kernel',
      example: 'rbf, linear, poly',
      inputHint: 'List the kernels you want cross-validation to compare.',
      helperText: 'Polynomial is usually slower and more flexible.',
      defaultExpression: (params) => String(params.kernel ?? 'rbf'),
    },
    {
      param: 'gamma',
      label: 'Gamma',
      example: 'scale, auto',
      inputHint: 'Use the named modes only.',
      helperText: 'Gamma matters for RBF and polynomial kernels.',
      defaultExpression: () => 'scale, auto',
    },
    {
      param: 'degree',
      label: 'Polynomial Degree',
      example: '2, 3, 4',
      inputHint: 'Used mainly when polynomial kernel is in the grid.',
      helperText: 'Higher degree can overfit quickly on smaller datasets.',
      defaultExpression: (params) => centeredInts(Number(params.degree ?? 3), 1, 2, 5),
    },
    {
      param: 'class_weight',
      label: 'Class Weight',
      example: 'none, balanced',
      inputHint: 'Compare neutral weighting against imbalance-aware weighting.',
      helperText: 'Useful when rare classes matter more than majority accuracy.',
      defaultExpression: (params) => String(params.class_weight ?? 'none'),
    },
  ],
  dt: [
    {
      param: 'criterion',
      label: 'Split Criterion',
      example: 'gini, entropy, log_loss',
      inputHint: 'List the impurity measures you want to compare.',
      helperText: 'This changes how split quality is scored.',
      defaultExpression: (params) => String(params.criterion ?? 'gini'),
    },
    {
      param: 'max_depth',
      label: 'Max Depth',
      example: '3, 5, 7',
      inputHint: 'Try a small depth band around the current setting.',
      helperText: 'Depth is one of the fastest levers for controlling overfit.',
      defaultExpression: (params) => centeredInts(Number(params.max_depth ?? 5), 2, 1, 30),
    },
    {
      param: 'min_samples_split',
      label: 'Min Samples to Split',
      example: '2, 4, 6',
      inputHint: 'Higher values force the tree to wait for stronger evidence.',
      helperText: 'This can stabilize noisy trees.',
      defaultExpression: (params) => centeredInts(Number(params.min_samples_split ?? 2), 2, 2, 50),
    },
    {
      param: 'min_samples_leaf',
      label: 'Min Samples per Leaf',
      example: '1, 2, 4',
      inputHint: 'Bigger leaves reduce variance.',
      helperText: 'Leaf size is a strong regularizer for trees.',
      defaultExpression: (params) => centeredInts(Number(params.min_samples_leaf ?? 1), 1, 1, 50),
    },
    {
      param: 'class_weight',
      label: 'Class Weight',
      example: 'none, balanced',
      inputHint: 'Useful when the target is imbalanced.',
      helperText: 'Balanced mode gives minority classes more influence.',
      defaultExpression: (params) => String(params.class_weight ?? 'none'),
    },
  ],
  rf: [
    {
      param: 'n_estimators',
      label: 'Number of Trees',
      example: '100, 150, 200',
      inputHint: 'Use integers only.',
      helperText: 'More trees usually stabilize the forest but take longer.',
      defaultExpression: (params) => centeredInts(Number(params.n_estimators ?? 100), 50, 50, 500),
    },
    {
      param: 'max_depth',
      label: 'Max Depth',
      example: '6, 10, 14',
      inputHint: 'Keep the grid narrow at first to control runtime.',
      helperText: 'Depth heavily affects overfitting in forests too.',
      defaultExpression: (params) => centeredInts(Number(params.max_depth ?? 10), 4, 1, 30),
    },
    {
      param: 'min_samples_leaf',
      label: 'Min Samples per Leaf',
      example: '1, 2, 4',
      inputHint: 'Higher leaf sizes usually reduce overfit.',
      helperText: 'A small leaf often inflates train scores.',
      defaultExpression: (params) => centeredInts(Number(params.min_samples_leaf ?? 1), 1, 1, 50),
    },
    {
      param: 'max_features',
      label: 'Features per Split',
      example: 'sqrt, log2, all',
      inputHint: 'Compare how much each tree can see at a split.',
      helperText: 'Lower feature counts diversify trees.',
      defaultExpression: (params) => String(params.max_features ?? 'sqrt'),
    },
    {
      param: 'bootstrap',
      label: 'Bootstrap',
      example: 'true, false',
      inputHint: 'Try both only if runtime is acceptable.',
      helperText: 'Bootstrapping changes how each tree samples rows.',
      defaultExpression: (params) => String(Boolean(params.bootstrap)),
    },
    {
      param: 'class_weight',
      label: 'Class Weight',
      example: 'none, balanced, balanced_subsample',
      inputHint: 'Only use the supported names.',
      helperText: 'Balanced subsample recomputes weights per tree sample.',
      defaultExpression: (params) => String(params.class_weight ?? 'none'),
    },
  ],
  et: [
    {
      param: 'n_estimators',
      label: 'Number of Trees',
      example: '100, 150, 200',
      inputHint: 'Use integers only.',
      helperText: 'Extra Trees often benefits from enough trees to average its randomness.',
      defaultExpression: (params) => centeredInts(Number(params.n_estimators ?? 150), 50, 50, 500),
    },
    {
      param: 'max_depth',
      label: 'Max Depth',
      example: '6, 10, 14',
      inputHint: 'Keep the grid narrow first.',
      helperText: 'Depth still controls complexity even with randomized splits.',
      defaultExpression: (params) => centeredInts(Number(params.max_depth ?? 10), 4, 1, 30),
    },
    {
      param: 'min_samples_leaf',
      label: 'Min Samples per Leaf',
      example: '1, 2, 4',
      inputHint: 'Higher values regularize aggressively.',
      helperText: 'Useful when Extra Trees memorizes too much.',
      defaultExpression: (params) => centeredInts(Number(params.min_samples_leaf ?? 1), 1, 1, 50),
    },
    {
      param: 'max_features',
      label: 'Features per Split',
      example: 'sqrt, log2, all',
      inputHint: 'These are the valid choices.',
      helperText: 'Randomness usually increases as each tree sees fewer features.',
      defaultExpression: (params) => String(params.max_features ?? 'sqrt'),
    },
    {
      param: 'bootstrap',
      label: 'Bootstrap',
      example: 'true, false',
      inputHint: 'Try both if you want to compare extra randomness.',
      helperText: 'Extra Trees commonly runs with bootstrap off.',
      defaultExpression: (params) => String(Boolean(params.bootstrap)),
    },
    {
      param: 'class_weight',
      label: 'Class Weight',
      example: 'none, balanced, balanced_subsample',
      inputHint: 'Only use the supported names.',
      helperText: 'This can matter a lot on skewed labels.',
      defaultExpression: (params) => String(params.class_weight ?? 'none'),
    },
  ],
  ada: [
    {
      param: 'n_estimators',
      label: 'Boosting Rounds',
      example: '50, 100, 150',
      inputHint: 'Use a modest band to keep search practical.',
      helperText: 'Too many rounds can chase noise.',
      defaultExpression: (params) => centeredInts(Number(params.n_estimators ?? 100), 50, 25, 500),
    },
    {
      param: 'learning_rate',
      label: 'Learning Rate',
      example: '0.1, 0.5, 1.0',
      inputHint: 'Use comma values or a float range.',
      helperText: 'Higher values make each boosting step more aggressive.',
      defaultExpression: (params) => centeredFloats(Number(params.learning_rate ?? 0.5), [0.5, 1, 2], 0.01, 2),
    },
    {
      param: 'estimator_depth',
      label: 'Base Tree Depth',
      example: '1, 2, 3',
      inputHint: 'AdaBoost usually works best with very shallow trees.',
      helperText: 'Deeper base trees can overfit fast.',
      defaultExpression: (params) => centeredInts(Number(params.estimator_depth ?? 1), 1, 1, 5),
    },
  ],
  lr: [
    {
      param: 'c',
      label: 'C',
      example: '0.25, 1, 4',
      inputHint: 'These values control the regularization strength.',
      helperText: 'Lower C means stronger regularization.',
      defaultExpression: (params) => centeredFloats(Number(params.c ?? 1), [0.25, 1, 4], 0.01, 100),
    },
    {
      param: 'max_iter',
      label: 'Max Iterations',
      example: '500, 1000, 2000',
      inputHint: 'Use bigger values if the optimizer needs more room.',
      helperText: 'This does not change model family, only optimization budget.',
      defaultExpression: (params) => centeredInts(Number(params.max_iter ?? 1000), 500, 100, 5000),
    },
    {
      param: 'class_weight',
      label: 'Class Weight',
      example: 'none, balanced',
      inputHint: 'Useful for skewed labels.',
      helperText: 'Balanced mode shifts the loss toward minority classes.',
      defaultExpression: (params) => String(params.class_weight ?? 'none'),
    },
  ],
  nb: [
    {
      param: 'var_smoothing',
      label: 'Variance Smoothing',
      example: '1e-10, 1e-9, 1e-8',
      inputHint: 'Scientific notation is supported.',
      helperText: 'This stabilizes variance estimates numerically.',
      defaultExpression: (params) => {
        const current = Number(params.var_smoothing ?? 1e-9);
        return [current / 10, current, current * 10]
          .map((value) => Number(value.toExponential(2)).toString())
          .join(', ');
      },
    },
  ],
  xgb: [
    {
      param: 'n_estimators',
      label: 'Boosting Rounds',
      example: '100, 200, 300',
      inputHint: 'Keep the grid compact because XGBoost can get expensive.',
      helperText: 'More rounds increase capacity and runtime.',
      defaultExpression: (params) => centeredInts(Number(params.n_estimators ?? 200), 100, 50, 500),
    },
    {
      param: 'max_depth',
      label: 'Max Depth',
      example: '4, 6, 8',
      inputHint: 'Depth is one of the strongest overfit levers.',
      helperText: 'Try shallow trees before pushing learning rate down too far.',
      defaultExpression: (params) => centeredInts(Number(params.max_depth ?? 6), 2, 2, 12),
    },
    {
      param: 'learning_rate',
      label: 'Learning Rate',
      example: '0.03, 0.1, 0.2',
      inputHint: 'Use a small set of meaningful rates.',
      helperText: 'Lower rates usually need more trees.',
      defaultExpression: (params) => centeredFloats(Number(params.learning_rate ?? 0.1), [0.5, 1, 2], 0.01, 0.5),
    },
    {
      param: 'subsample',
      label: 'Row Subsample',
      example: '0.7, 0.85, 1.0',
      inputHint: 'Values must stay between 0.5 and 1.0.',
      helperText: 'Lower values regularize by sampling fewer rows per tree.',
      defaultExpression: (params) => centeredFloats(Number(params.subsample ?? 1), [0.75, 0.9, 1], 0.5, 1),
    },
    {
      param: 'colsample_bytree',
      label: 'Feature Subsample',
      example: '0.7, 0.85, 1.0',
      inputHint: 'Values must stay between 0.5 and 1.0.',
      helperText: 'Lower values increase tree diversity.',
      defaultExpression: (params) => centeredFloats(Number(params.colsample_bytree ?? 1), [0.75, 0.9, 1], 0.5, 1),
    },
    {
      param: 'reg_lambda',
      label: 'L2 Regularization',
      example: '0, 1, 3',
      inputHint: 'Use larger values only if the model is getting too sharp.',
      helperText: 'This shrinks leaf weights.',
      defaultExpression: (params) => centeredFloats(Number(params.reg_lambda ?? 1), [0.5, 1, 2], 0, 10),
    },
  ],
  lgbm: [
    {
      param: 'n_estimators',
      label: 'Boosting Rounds',
      example: '100, 200, 300',
      inputHint: 'Use integers only.',
      helperText: 'More rounds can improve fit but cost time.',
      defaultExpression: (params) => centeredInts(Number(params.n_estimators ?? 200), 100, 50, 500),
    },
    {
      param: 'max_depth',
      label: 'Max Depth',
      example: '-1, 6, 10',
      inputHint: '-1 means unlimited depth for LightGBM.',
      helperText: 'Constrain this when overfit risk is high.',
      defaultExpression: (params) => {
        const current = Number(params.max_depth ?? -1);
        return current <= 0 ? '-1, 6, 10' : centeredInts(current, 4, -1, 16);
      },
    },
    {
      param: 'learning_rate',
      label: 'Learning Rate',
      example: '0.03, 0.1, 0.2',
      inputHint: 'Use a compact float grid.',
      helperText: 'Lower rates often need more rounds.',
      defaultExpression: (params) => centeredFloats(Number(params.learning_rate ?? 0.1), [0.5, 1, 2], 0.01, 0.5),
    },
    {
      param: 'num_leaves',
      label: 'Num Leaves',
      example: '16, 31, 48',
      inputHint: 'Keep leaf counts reasonable to avoid overfit.',
      helperText: 'Leaf-wise growth makes this parameter powerful.',
      defaultExpression: (params) => centeredInts(Number(params.num_leaves ?? 31), 16, 8, 128),
    },
    {
      param: 'subsample',
      label: 'Row Subsample',
      example: '0.7, 0.85, 1.0',
      inputHint: 'Values must stay between 0.5 and 1.0.',
      helperText: 'This is one of the easiest regularization levers.',
      defaultExpression: (params) => centeredFloats(Number(params.subsample ?? 1), [0.75, 0.9, 1], 0.5, 1),
    },
    {
      param: 'colsample_bytree',
      label: 'Feature Subsample',
      example: '0.7, 0.85, 1.0',
      inputHint: 'Values must stay between 0.5 and 1.0.',
      helperText: 'Lower values diversify each round.',
      defaultExpression: (params) => centeredFloats(Number(params.colsample_bytree ?? 1), [0.75, 0.9, 1], 0.5, 1),
    },
  ],
  catboost: [
    {
      param: 'iterations',
      label: 'Iterations',
      example: '100, 200, 300',
      inputHint: 'Use integers only.',
      helperText: 'More iterations increase capacity and runtime.',
      defaultExpression: (params) => centeredInts(Number(params.iterations ?? 200), 100, 50, 500),
    },
    {
      param: 'depth',
      label: 'Tree Depth',
      example: '4, 6, 8',
      inputHint: 'Depth is a strong complexity lever.',
      helperText: 'Too much depth often means optimistic train scores.',
      defaultExpression: (params) => centeredInts(Number(params.depth ?? 6), 2, 2, 10),
    },
    {
      param: 'learning_rate',
      label: 'Learning Rate',
      example: '0.03, 0.1, 0.2',
      inputHint: 'Use comma values or a float range.',
      helperText: 'Lower rates can generalize better, but train slower.',
      defaultExpression: (params) => centeredFloats(Number(params.learning_rate ?? 0.1), [0.5, 1, 2], 0.01, 0.5),
    },
    {
      param: 'l2_leaf_reg',
      label: 'L2 Leaf Reg',
      example: '2, 3, 5',
      inputHint: 'This regularizes leaf values.',
      helperText: 'Higher values smooth the model more strongly.',
      defaultExpression: (params) => centeredFloats(Number(params.l2_leaf_reg ?? 3), [0.66, 1, 1.66], 1, 10),
    },
  ],
};

export function buildResolvedSearchConfig<T extends ModelId>(
  model: T,
  config: GridSearchConfig,
  params: ModelParamsById[T],
): GridSearchConfig {
  if (!config.enabled) {
    return {
      ...config,
      parameter_space: {},
    };
  }

  const definitions = MODEL_SEARCH_FIELDS[model];
  const parameterSpace = definitions.reduce<Record<string, string>>((acc, field) => {
    const manualExpression = config.parameter_space[field.param]?.trim();
    acc[field.param] = manualExpression || serializeCurrentValue((params as Record<string, unknown>)[field.param]);
    return acc;
  }, {});

  return {
    ...config,
    parameter_space: parameterSpace,
  };
}
