import React from 'react';
import {
  BinaryClassWeight,
  KNNWeights,
  ModelId,
  RFClassWeight,
  RFMaxFeatures,
  SearchScoring,
  SvmGamma,
  SvmKernel,
  TreeCriterion,
  useModelStore,
} from '../../../../store/useModelStore';
import { InfoBox, ParamSlider, SelectField, ToggleField, type FieldInfo } from './TrainingControls';
import { MODEL_SEARCH_FIELDS } from '../searchSpace';

const explain = (title: string, body: string, why: string): FieldInfo => ({
  title,
  content: (
    <>
      <p>{body}</p>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">
        <strong className="font-bold text-slate-900">Why it matters:</strong> {why}
      </p>
    </>
  ),
});

function formatCurrentValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function parseExpressionValues(expression: string): string[] {
  const value = expression.trim();
  if (!value) {
    return [];
  }

  if (value.includes(':')) {
    const parts = value.split(':').map((part) => part.trim());
    if ((parts.length === 2 || parts.length === 3) && parts.every(Boolean)) {
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      const step = parts.length === 3 ? Number(parts[2]) : 1;
      if (Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(step) && step > 0) {
        const lower = Math.min(start, end);
        const upper = Math.max(start, end);
        const values: string[] = [];
        let cursor = lower;
        let guard = 0;
        while (cursor <= upper + 1e-9 && guard < 24) {
          values.push(formatCurrentValue(cursor));
          cursor += step;
          guard += 1;
        }
        return values;
      }
    }
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function orderCandidateValues(values: string[]): string[] {
  const unique = uniqueValues(values);
  const lower = unique.map((value) => value.toLowerCase());
  if (lower.every((value) => value === 'true' || value === 'false')) {
    return [...unique].sort((left, right) => Number(left.toLowerCase() === 'true') - Number(right.toLowerCase() === 'true'));
  }

  const numeric = unique.map((value) => Number(value));
  if (numeric.every((value) => Number.isFinite(value))) {
    return [...unique].sort((left, right) => Number(left) - Number(right));
  }

  return unique;
}

function inferExpandedNumericCandidates(currentValue: unknown, seeds: string[]): string[] {
  const currentNumber = Number(currentValue);
  const seedNumbers = seeds.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!Number.isFinite(currentNumber) || seedNumbers.length === 0) {
    return [];
  }

  const sorted = [...new Set(seedNumbers)].sort((left, right) => left - right);
  let step = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const diff = sorted[index] - sorted[index - 1];
    if (diff > 0) {
      step = step === 0 ? diff : Math.min(step, diff);
    }
  }

  if (step === 0) {
    step = Number.isInteger(currentNumber) ? 1 : Math.max(0.01, Math.abs(currentNumber) / 2);
  }

  return [
    currentNumber - step * 2,
    currentNumber - step,
    currentNumber,
    currentNumber + step,
    currentNumber + step * 2,
  ].map((value) => formatCurrentValue(value));
}

function toggleCandidateValue(expression: string, currentValue: unknown, candidate: string): string {
  const fallback = formatCurrentValue(currentValue);
  const currentTokens = uniqueValues(parseExpressionValues(expression || fallback));
  const nextTokens = currentTokens.includes(candidate)
    ? currentTokens.filter((token) => token !== candidate)
    : [...currentTokens, candidate];
  const orderedTokens = orderCandidateValues(nextTokens);
  return orderedTokens.length === 0 ? '' : orderedTokens.join(', ');
}

const GridSearchPanel: React.FC<{ model: ModelId }> = ({ model }) => {
  const { modelParams, searchConfigs, setSearchConfig } = useModelStore();
  const config = searchConfigs[model];
  const currentParams = modelParams[model] as Record<string, unknown>;
  const fields = MODEL_SEARCH_FIELDS[model];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Grid Search</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Search happens only on the training split. Validation or test stays untouched for honest comparison, so the ranking you see later stays honest.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={config.enabled}
          onClick={() => setSearchConfig(model, { enabled: !config.enabled })}
          className={`inline-flex min-w-[172px] shrink-0 items-center justify-between rounded-full border px-3 py-2 text-xs font-bold shadow-sm transition-all ${
            config.enabled
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:border-indigo-400'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="pr-3">{config.enabled ? 'Grid search on' : 'Grid search off'}</span>
          <span
            className={`relative flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
              config.enabled ? 'bg-indigo-500 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <span className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform" />
          </span>
        </button>
      </div>

      <InfoBox title="How to write a search grid">
        Use comma-separated candidates like <strong>100, 200, 300</strong> or a numeric range like <strong>0.05:0.2:0.05</strong>.
        If you leave a line untouched, that parameter stays fixed at its current value and does not widen the search.
      </InfoBox>

      <div className="grid gap-4 md:grid-cols-2">
        <ParamSlider
          label="CV Folds"
          hint="More folds reduce score variance, but every extra fold makes the search slower."
          value={config.cv_folds}
          min={2}
          max={8}
          step={1}
          onChange={(value) => setSearchConfig(model, { cv_folds: Math.round(value) })}
          info={explain(
            'CV folds',
            'Cross-validation splits the training set into multiple train/validation rotations. The model trains several times so the search score does not depend on one lucky split.',
            'Higher folds usually give a steadier estimate, but runtime grows because each candidate is trained repeatedly.'
          )}
        />
        <SelectField
          label="Search Metric"
          hint="Auto prefers F1 so weak classes are not hidden behind accuracy."
          value={config.scoring}
          onChange={(value) => setSearchConfig(model, { scoring: value as SearchScoring })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'accuracy', label: 'Accuracy' },
            { value: 'f1', label: 'F1 Score' },
            { value: 'precision', label: 'Precision' },
            { value: 'recall', label: 'Recall' },
            { value: 'roc_auc', label: 'ROC AUC' },
          ]}
          info={explain(
            'Search metric',
            'This is the score GridSearchCV uses to decide which hyperparameter combination wins.',
            'If your problem is imbalanced, accuracy can look healthy while minority-class behavior stays weak. F1 is often safer as a default.'
          )}
        />
      </div>

      {config.enabled ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Candidate Values</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Each line controls exactly which values the search is allowed to try for that parameter.
            </p>
          </div>
          <div className="space-y-3">
            {fields.map((field) => {
              const value = config.parameter_space[field.param] ?? '';
              const currentValue = currentParams[field.param];
              const placeholder = field.defaultExpression(currentParams);
              const selectedValues = orderCandidateValues(parseExpressionValues(value || formatCurrentValue(currentValue)));
              const suggestedValues = orderCandidateValues([
                ...parseExpressionValues(field.example),
                ...parseExpressionValues(placeholder),
                ...inferExpandedNumericCandidates(currentValue, parseExpressionValues(placeholder)),
                formatCurrentValue(currentValue),
              ]);
              return (
                <div key={field.param} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{field.label}</p>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          current: {formatCurrentValue(currentValue)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{field.helperText}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {suggestedValues.map((candidate) => {
                          const selected = selectedValues.includes(candidate);
                          return (
                            <button
                              key={`${field.param}-${candidate}`}
                              type="button"
                              onClick={() =>
                                setSearchConfig(model, {
                                  parameter_space: {
                                    ...config.parameter_space,
                                    [field.param]: toggleCandidateValue(value, currentValue, candidate),
                                  },
                                })
                              }
                              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                selected
                                  ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {candidate}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          setSearchConfig(model, {
                            parameter_space: {
                              ...config.parameter_space,
                              [field.param]: event.target.value,
                            },
                          })
                        }
                        placeholder={placeholder}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-600">Example: {field.example}</span>
                        <span>{field.inputHint}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                          blank = keep current value
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const TreePanel: React.FC<{ model: 'dt' | 'rf' | 'et' }> = ({ model }) => {
  const { modelParams, setModelParam } = useModelStore();
  const params = modelParams[model];
  const isForest = model !== 'dt';

  return (
    <div className="space-y-4">
      <SelectField
        label="Split Criterion"
        hint="This controls how each split scores purity."
        value={params.criterion}
        onChange={(value) => setModelParam(model, { criterion: value as TreeCriterion })}
        info={explain(
          'Split criterion',
          'Trees choose each branch by optimizing an impurity measure such as Gini or entropy.',
          'Different criteria usually do not change the model family, but they can slightly change which splits are preferred.'
        )}
        options={[
          { value: 'gini', label: 'Gini' },
          { value: 'entropy', label: 'Entropy' },
          { value: 'log_loss', label: 'Log loss' },
        ]}
      />
      {isForest && (
        <ParamSlider
          label="Number of Trees"
          hint="More trees often improve stability, but they also cost more time."
          value={params.n_estimators}
          min={50}
          max={500}
          step={25}
          onChange={(value) => setModelParam(model, { n_estimators: Math.round(value) })}
          info={explain(
            'Number of trees',
            'The forest is an average of many trees. More trees usually make the result steadier.',
            'This often improves stability, but after a point you mostly pay extra runtime for small gains.'
          )}
        />
      )}
      <ParamSlider
        label="Max Depth"
        hint="Deeper trees memorize more details and can overfit faster."
        value={params.max_depth}
        min={1}
        max={30}
        onChange={(value) => setModelParam(model, { max_depth: Math.round(value) })}
        info={explain(
          'Max depth',
          'This limits how many levels a tree can grow before it must stop splitting.',
          'Depth is one of the strongest knobs for controlling overfitting in tree-based models.'
        )}
      />
      <ParamSlider
        label="Min Samples to Split"
        hint="Higher values make the tree wait for more evidence before branching."
        value={params.min_samples_split}
        min={2}
        max={20}
        onChange={(value) => setModelParam(model, { min_samples_split: Math.round(value) })}
        info={explain(
          'Min samples to split',
          'A node needs at least this many training rows before the tree is allowed to split it.',
          'Raising it makes the tree less eager and can prevent brittle micro-branches.'
        )}
      />
      <ParamSlider
        label="Min Samples per Leaf"
        hint="Larger leaves smooth the model and make it less twitchy."
        value={params.min_samples_leaf}
        min={1}
        max={20}
        onChange={(value) => setModelParam(model, { min_samples_leaf: Math.round(value) })}
        info={explain(
          'Min samples per leaf',
          'Every final leaf must contain at least this many rows.',
          'Larger leaves smooth the decision surface and usually reduce variance.'
        )}
      />
      {isForest && (
        <>
          <SelectField
            label="Features per Split"
            hint="Lower values diversify trees. Higher values let each tree inspect more features."
            value={params.max_features}
            onChange={(value) => setModelParam(model, { max_features: value as RFMaxFeatures })}
            info={explain(
              'Features per split',
              'This controls how many candidate features each tree may inspect when looking for the next split.',
              'Lower values add randomness and diversity. Higher values can fit stronger trees but may correlate them more.'
            )}
            options={[
              { value: 'sqrt', label: 'Sqrt' },
              { value: 'log2', label: 'Log2' },
              { value: 'all', label: 'All features' },
            ]}
          />
          <ToggleField
            label="Bootstrap"
            hint="Bootstrap resamples the training set for each tree. Extra Trees often works well with it off."
            value={params.bootstrap}
            onChange={(value) => setModelParam(model, { bootstrap: value })}
            trueLabel="On"
            falseLabel="Off"
            info={explain(
              'Bootstrap',
              'When bootstrap is on, each tree sees a sampled version of the training data instead of the full set.',
              'Sampling changes tree diversity and can improve robustness, especially in classic random forests.'
            )}
          />
        </>
      )}
      <SelectField
        label="Class Weight"
        hint="Balanced options can help when one class is much rarer."
        value={params.class_weight}
        onChange={(value) => setModelParam(model, { class_weight: value as RFClassWeight | BinaryClassWeight })}
        info={explain(
          'Class weight',
          'This tells the learner to penalize mistakes on rare classes more strongly than mistakes on common classes.',
          'It is useful when minority-class recall matters and plain accuracy hides that imbalance.'
        )}
        options={
          isForest
            ? [
                { value: 'none', label: 'None' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'balanced_subsample', label: 'Balanced per sample' },
              ]
            : [
                { value: 'none', label: 'None' },
                { value: 'balanced', label: 'Balanced' },
              ]
        }
      />
      <InfoBox title="What to watch">
        {isForest
          ? 'If train performance keeps rising while validation or test stalls, reduce depth or increase leaf size.'
          : 'Single trees are easy to read, but a deep tree with tiny leaves usually means poor generalization.'}
      </InfoBox>
      <GridSearchPanel model={model} />
    </div>
  );
};

export const ModelParamsPanel: React.FC<{ model: ModelId }> = ({ model }) => {
  const { modelParams, setModelParam } = useModelStore();
  const params = modelParams;

  if (model === 'knn') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="K Neighbors"
          hint="Low K reacts to very local cases. High K smooths more and may hide minority patterns."
          value={params.knn.k}
          min={1}
          max={50}
          onChange={(value) => setModelParam('knn', { k: Math.round(value) })}
          info={explain(
            'K neighbors',
            'KNN predicts by looking at the nearest training examples and letting them vote.',
            'Small K reacts quickly to local structure. Large K smooths the decision but can wash out minority patterns.'
          )}
        />
        <SelectField
          label="Voting Strategy"
          hint="Distance weighting lets closer examples matter more than far ones."
          value={params.knn.weights}
          onChange={(value) => setModelParam('knn', { weights: value as KNNWeights })}
          info={explain(
            'Voting strategy',
            'Uniform voting gives each neighbor the same voice. Distance voting lets closer neighbors count more.',
            'Distance weighting can help when the nearest few examples are much more trustworthy than farther ones.'
          )}
          options={[
            { value: 'uniform', label: 'Uniform votes' },
            { value: 'distance', label: 'Distance-weighted votes' },
          ]}
        />
        <SelectField
          label="Distance Metric"
          hint="Euclidean is the common default. Manhattan can behave better on spiky features."
          value={String(params.knn.p)}
          onChange={(value) => setModelParam('knn', { p: Number(value) as 1 | 2 })}
          info={explain(
            'Distance metric',
            'This defines what “near” means when KNN searches for neighbors.',
            'Different metrics change neighborhood shape, which can matter when features are sparse or have sharp jumps.'
          )}
          options={[
            { value: '2', label: 'Euclidean (p = 2)' },
            { value: '1', label: 'Manhattan (p = 1)' },
          ]}
        />
        <InfoBox title="What to watch">
          Large <strong>K</strong> can wash out minority cases, while very small <strong>K</strong> can chase noise.
        </InfoBox>
        <GridSearchPanel model="knn" />
      </div>
    );
  }

  if (model === 'svm') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="C"
          hint="Higher C pushes harder to classify training rows correctly, which can overfit."
          value={params.svm.c}
          min={0.1}
          max={10}
          step={0.1}
          format={(value) => value.toFixed(1)}
          onChange={(value) => setModelParam('svm', { c: value })}
          info={explain(
            'C penalty',
            'C controls how strongly SVM resists training errors versus keeping a wider margin.',
            'High C can fit training data very tightly. Lower C regularizes more strongly.'
          )}
        />
        <SelectField
          label="Kernel"
          hint="Linear is simplest. RBF handles curved boundaries. Polynomial is expressive but easier to overfit."
          value={params.svm.kernel}
          onChange={(value) => setModelParam('svm', { kernel: value as SvmKernel })}
          info={explain(
            'Kernel',
            'The kernel decides what kind of boundary the SVM is allowed to learn.',
            'Linear is the simplest. RBF handles curved boundaries. Polynomial can be expressive but is easier to destabilize.'
          )}
          options={[
            { value: 'rbf', label: 'RBF' },
            { value: 'linear', label: 'Linear' },
            { value: 'poly', label: 'Polynomial' },
          ]}
        />
        <SelectField
          label="Gamma"
          hint="Controls how narrow each local influence zone is."
          value={params.svm.gamma}
          onChange={(value) => setModelParam('svm', { gamma: value as SvmGamma })}
          info={explain(
            'Gamma',
            'Gamma controls how local each support vector influence becomes in nonlinear kernels.',
            'Higher effective gamma makes the boundary react to smaller neighborhoods, which can increase overfit risk.'
          )}
          options={[
            { value: 'scale', label: 'Scale' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        {params.svm.kernel === 'poly' && (
          <ParamSlider
            label="Polynomial Degree"
            hint="Higher degree bends the boundary more, but makes the model less stable on small datasets."
            value={params.svm.degree}
            min={2}
            max={5}
            onChange={(value) => setModelParam('svm', { degree: Math.round(value) })}
            info={explain(
              'Polynomial degree',
              'This controls how curved the polynomial kernel may become.',
              'Higher degrees can model complex interactions, but they become unstable faster on limited data.'
            )}
          />
        )}
        <SelectField
          label="Class Weight"
          hint="Balanced mode helps when one class is much rarer."
          value={params.svm.class_weight}
          onChange={(value) => setModelParam('svm', { class_weight: value as BinaryClassWeight })}
          info={explain(
            'Class weight',
            'Balanced mode increases the training penalty for mistakes on the minority class.',
            'This is useful when the smaller class matters and you do not want overall accuracy to dominate.'
          )}
          options={[
            { value: 'none', label: 'None' },
            { value: 'balanced', label: 'Balanced' },
          ]}
        />
        <InfoBox title="What to watch">
          Very high <strong>C</strong> together with a flexible kernel is one of the fastest ways to overfit.
        </InfoBox>
        <GridSearchPanel model="svm" />
      </div>
    );
  }

  if (model === 'dt' || model === 'rf' || model === 'et') {
    return <TreePanel model={model} />;
  }

  if (model === 'ada') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="Boosting Rounds"
          hint="More rounds give the ensemble more chances to correct mistakes, but can overfit."
          value={params.ada.n_estimators}
          min={25}
          max={500}
          step={25}
          onChange={(value) => setModelParam('ada', { n_estimators: Math.round(value) })}
          info={explain(
            'Boosting rounds',
            'AdaBoost adds weak learners one after another, with each round trying to fix earlier mistakes.',
            'More rounds increase capacity, but they can also start chasing noisy training rows.'
          )}
        />
        <ParamSlider
          label="Learning Rate"
          hint="Higher values make each round more aggressive."
          value={params.ada.learning_rate}
          min={0.01}
          max={2}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('ada', { learning_rate: value })}
          info={explain(
            'Learning rate',
            'This scales how much each new weak learner can change the ensemble.',
            'Higher values make training more aggressive. Lower values are slower but often steadier.'
          )}
        />
        <ParamSlider
          label="Base Tree Depth"
          hint="AdaBoost usually works best with very shallow trees."
          value={params.ada.estimator_depth}
          min={1}
          max={5}
          onChange={(value) => setModelParam('ada', { estimator_depth: Math.round(value) })}
          info={explain(
            'Base tree depth',
            'AdaBoost usually builds on shallow decision trees, often called decision stumps when depth is 1.',
            'Deep base trees can make the ensemble too expressive and hurt generalization quickly.'
          )}
        />
        <InfoBox title="What to watch">
          If the model becomes unstable, reduce the base tree depth before adding more rounds.
        </InfoBox>
        <GridSearchPanel model="ada" />
      </div>
    );
  }

  if (model === 'lr') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="C"
          hint="Lower C means stronger regularization. Higher C relaxes that penalty."
          value={params.lr.c}
          min={0.1}
          max={10}
          step={0.1}
          format={(value) => value.toFixed(1)}
          onChange={(value) => setModelParam('lr', { c: value })}
          info={explain(
            'C penalty',
            'In logistic regression, C is the inverse of regularization strength.',
            'Lower C shrinks coefficients more strongly. Higher C lets the model fit training data more freely.'
          )}
        />
        <ParamSlider
          label="Max Iterations"
          hint="If optimization stops too early, coefficients may not settle."
          value={params.lr.max_iter}
          min={100}
          max={5000}
          step={100}
          onChange={(value) => setModelParam('lr', { max_iter: Math.round(value) })}
          info={explain(
            'Max iterations',
            'This is the optimizer budget, not model complexity itself.',
            'If it is too low, training may stop before the coefficients converge to a stable solution.'
          )}
        />
        <SelectField
          label="Class Weight"
          hint="Balanced mode makes the linear model care more about the smaller class."
          value={params.lr.class_weight}
          onChange={(value) => setModelParam('lr', { class_weight: value as BinaryClassWeight })}
          info={explain(
            'Class weight',
            'Balanced mode scales the loss so minority-class mistakes count more.',
            'That can improve recall on rare labels when a neutral linear baseline leans too hard toward the majority.'
          )}
          options={[
            { value: 'none', label: 'None' },
            { value: 'balanced', label: 'Balanced' },
          ]}
        />
        <InfoBox title="What to watch">
          Logistic regression is a strong sanity-check baseline and often tells you whether the preprocessing is helping.
        </InfoBox>
        <GridSearchPanel model="lr" />
      </div>
    );
  }

  if (model === 'nb') {
    return (
      <div className="space-y-4">
        <SelectField
          label="Variance Smoothing"
          hint="Adds a stabilizer to variance estimates so Naive Bayes stays numerically safe."
          value={String(params.nb.var_smoothing)}
          onChange={(value) => setModelParam('nb', { var_smoothing: Number(value) })}
          info={explain(
            'Variance smoothing',
            'Gaussian Naive Bayes estimates a variance for each feature and class. This term prevents those estimates from collapsing numerically.',
            'Very tiny values can become unstable, while larger values smooth the likelihoods more.'
          )}
          options={[
            { value: '1e-12', label: '1e-12' },
            { value: '1e-10', label: '1e-10' },
            { value: '1e-9', label: '1e-9' },
            { value: '1e-8', label: '1e-8' },
            { value: '1e-6', label: '1e-6' },
          ]}
        />
        <InfoBox title="What to watch">
          Naive Bayes is fast and useful as a baseline, but its independence assumption can cap peak performance.
        </InfoBox>
        <GridSearchPanel model="nb" />
      </div>
    );
  }

  if (model === 'xgb') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="Boosting Rounds"
          hint="More rounds can improve fit, but watch the validation gap."
          value={params.xgb.n_estimators}
          min={50}
          max={500}
          step={25}
          onChange={(value) => setModelParam('xgb', { n_estimators: Math.round(value) })}
          info={explain(
            'Boosting rounds',
            'XGBoost adds one tree at a time, with each tree correcting the residual mistakes left so far.',
            'More rounds increase capacity and runtime. If train keeps improving while validation stalls, this is often too high.'
          )}
        />
        <ParamSlider
          label="Max Depth"
          hint="Deeper trees model more interactions, but overfit more easily."
          value={params.xgb.max_depth}
          min={2}
          max={12}
          onChange={(value) => setModelParam('xgb', { max_depth: Math.round(value) })}
          info={explain(
            'Max depth',
            'This controls how complex each boosted tree is allowed to become.',
            'Depth is a major overfit lever in gradient boosting.'
          )}
        />
        <ParamSlider
          label="Learning Rate"
          hint="Lower learning rates are slower but usually steadier."
          value={params.xgb.learning_rate}
          min={0.01}
          max={0.5}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('xgb', { learning_rate: value })}
          info={explain(
            'Learning rate',
            'This shrinks the contribution of each new tree before it is added to the ensemble.',
            'Lower values often generalize better, but they usually need more trees.'
          )}
        />
        <ParamSlider
          label="Row Subsample"
          hint="Training on a fraction of rows per tree can reduce overfitting."
          value={params.xgb.subsample}
          min={0.5}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('xgb', { subsample: value })}
          info={explain(
            'Row subsample',
            'Each tree can train on only a fraction of rows instead of all rows.',
            'This regularizes the model and can reduce overfitting.'
          )}
        />
        <ParamSlider
          label="Feature Subsample"
          hint="Each tree can look at only part of the feature set to improve diversity."
          value={params.xgb.colsample_bytree}
          min={0.5}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('xgb', { colsample_bytree: value })}
          info={explain(
            'Feature subsample',
            'Each tree can inspect only part of the feature space when it is built.',
            'Lower values increase diversity and can help generalization.'
          )}
        />
        <ParamSlider
          label="L2 Regularization"
          hint="Higher values shrink the model and can help when boosted trees get too sharp."
          value={params.xgb.reg_lambda}
          min={0}
          max={10}
          step={0.1}
          format={(value) => value.toFixed(1)}
          onChange={(value) => setModelParam('xgb', { reg_lambda: value })}
          info={explain(
            'L2 regularization',
            'This penalizes large leaf weights inside the boosted trees.',
            'It can smooth a model that is becoming too sharp or too sensitive to noise.'
          )}
        />
        <InfoBox title="What to watch">
          XGBoost is powerful, but if train stays far above validation or test, lower depth or learning rate first.
        </InfoBox>
        <GridSearchPanel model="xgb" />
      </div>
    );
  }

  if (model === 'lgbm') {
    return (
      <div className="space-y-4">
        <ParamSlider
          label="Boosting Rounds"
          hint="More rounds increase capacity and runtime."
          value={params.lgbm.n_estimators}
          min={50}
          max={500}
          step={25}
          onChange={(value) => setModelParam('lgbm', { n_estimators: Math.round(value) })}
          info={explain(
            'Boosting rounds',
            'LightGBM also grows one tree at a time and accumulates them into an ensemble.',
            'More rounds can improve fit, but they also increase runtime and overfit risk.'
          )}
        />
        <ParamSlider
          label="Max Depth"
          hint="Use -1 to let the tree grow freely. Lower values constrain complexity."
          value={params.lgbm.max_depth}
          min={-1}
          max={16}
          step={1}
          onChange={(value) => setModelParam('lgbm', { max_depth: Math.round(value) })}
          info={explain(
            'Max depth',
            'This limits how deep each LightGBM tree may grow. A value of -1 means no depth cap.',
            'Unlimited depth can be powerful, but it often needs stronger regularization elsewhere.'
          )}
        />
        <ParamSlider
          label="Learning Rate"
          hint="Lower learning rates are usually steadier when you use many rounds."
          value={params.lgbm.learning_rate}
          min={0.01}
          max={0.5}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('lgbm', { learning_rate: value })}
          info={explain(
            'Learning rate',
            'This scales how much each new tree changes the current ensemble.',
            'Lower values are calmer, but they usually need more trees to reach the same fit.'
          )}
        />
        <ParamSlider
          label="Num Leaves"
          hint="Leaf-wise growth is powerful, so too many leaves can overfit quickly."
          value={params.lgbm.num_leaves}
          min={8}
          max={128}
          step={1}
          onChange={(value) => setModelParam('lgbm', { num_leaves: Math.round(value) })}
          info={explain(
            'Num leaves',
            'LightGBM grows trees leaf-wise, so the number of leaves directly controls how expressive each tree can become.',
            'High leaf counts are powerful, but they can overfit surprisingly fast.'
          )}
        />
        <ParamSlider
          label="Row Subsample"
          hint="Lower values regularize the boosting process."
          value={params.lgbm.subsample}
          min={0.5}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('lgbm', { subsample: value })}
          info={explain(
            'Row subsample',
            'Each boosting round can sample only part of the rows.',
            'This is a useful regularization knob when LightGBM learns too aggressively.'
          )}
        />
        <ParamSlider
          label="Feature Subsample"
          hint="Reducing features per round can help generalization."
          value={params.lgbm.colsample_bytree}
          min={0.5}
          max={1}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(value) => setModelParam('lgbm', { colsample_bytree: value })}
          info={explain(
            'Feature subsample',
            'Each tree can inspect only a subset of features.',
            'This can improve generalization by reducing feature co-adaptation.'
          )}
        />
        <InfoBox title="What to watch">
          LightGBM can get very strong quickly, but high leaves plus weak regularization often means optimistic train scores.
        </InfoBox>
        <GridSearchPanel model="lgbm" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ParamSlider
        label="Iterations"
        hint="More boosting rounds increase capacity and runtime."
        value={params.catboost.iterations}
        min={50}
        max={500}
        step={25}
        onChange={(value) => setModelParam('catboost', { iterations: Math.round(value) })}
        info={explain(
          'Iterations',
          'CatBoost also builds trees sequentially. Each iteration adds another tree to the ensemble.',
          'More iterations can improve fit, but only if validation keeps improving too.'
        )}
      />
      <ParamSlider
        label="Tree Depth"
        hint="Deeper trees model richer interactions, but may overfit."
        value={params.catboost.depth}
        min={2}
        max={10}
        onChange={(value) => setModelParam('catboost', { depth: Math.round(value) })}
        info={explain(
          'Tree depth',
          'This limits how rich each CatBoost tree can become.',
          'Depth is a direct complexity control and a common source of overfit if pushed too high.'
        )}
      />
      <ParamSlider
        label="Learning Rate"
        hint="Lower values are slower but can yield smoother generalization."
        value={params.catboost.learning_rate}
        min={0.01}
        max={0.5}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onChange={(value) => setModelParam('catboost', { learning_rate: value })}
        info={explain(
          'Learning rate',
          'This scales the impact of each new tree before it is added.',
          'Smaller rates often give smoother generalization, but they need more iterations.'
        )}
      />
      <ParamSlider
        label="L2 Leaf Reg"
        hint="Higher regularization makes leaf values less extreme."
        value={params.catboost.l2_leaf_reg}
        min={1}
        max={10}
        step={0.1}
        format={(value) => value.toFixed(1)}
        onChange={(value) => setModelParam('catboost', { l2_leaf_reg: value })}
        info={explain(
          'L2 leaf regularization',
          'This penalizes extreme leaf values inside CatBoost trees.',
          'It can calm a model that is fitting training data too sharply.'
        )}
      />
      <InfoBox title="What to watch">
        CatBoost is often stable on tabular data, but it still needs validation and test gaps watched carefully.
      </InfoBox>
      <GridSearchPanel model="catboost" />
    </div>
  );
};

export default ModelParamsPanel;
