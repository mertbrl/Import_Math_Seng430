from __future__ import annotations

from typing import Any

from sklearn.ensemble import AdaBoostClassifier, AdaBoostRegressor, ExtraTreesClassifier, ExtraTreesRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neighbors import KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.core.exceptions import PipelineError
from app.services.model_training.external_models import require_external_class


class SklearnEstimatorFactory:
    def create(
        self,
        algorithm: str,
        params: dict[str, Any],
        *,
        class_count: int = 2,
        problem_type: str = "classification",
    ) -> Any:
        estimator_params = self.to_estimator_params(
            algorithm,
            params,
            class_count=class_count,
            problem_type=problem_type,
        )

        if problem_type == "regression":
            if algorithm == "knn":
                return KNeighborsRegressor(**estimator_params)

            if algorithm == "svm":
                return SVR(**estimator_params)

            if algorithm == "dt":
                return DecisionTreeRegressor(**estimator_params)

            if algorithm == "rf":
                return RandomForestRegressor(**estimator_params)

            if algorithm == "et":
                return ExtraTreesRegressor(**estimator_params)

            if algorithm == "ada":
                return AdaBoostRegressor(**estimator_params)

            if algorithm == "lr":
                return LinearRegression(**estimator_params)

            if algorithm == "nb":
                return Ridge(**estimator_params)

            if algorithm == "xgb":
                XGBRegressor = require_external_class("xgboost", "XGBRegressor", model_label="XGBoost")
                return XGBRegressor(**estimator_params)

            if algorithm == "lgbm":
                LGBMRegressor = require_external_class("lightgbm", "LGBMRegressor", model_label="LightGBM")
                return LGBMRegressor(**estimator_params)

            if algorithm == "catboost":
                CatBoostRegressor = require_external_class("catboost", "CatBoostRegressor", model_label="CatBoost")
                return CatBoostRegressor(**estimator_params)

        if algorithm == "knn":
            return KNeighborsClassifier(**estimator_params)

        if algorithm == "svm":
            return SVC(**estimator_params)

        if algorithm == "dt":
            return DecisionTreeClassifier(**estimator_params)

        if algorithm == "rf":
            return RandomForestClassifier(**estimator_params)

        if algorithm == "et":
            return ExtraTreesClassifier(**estimator_params)

        if algorithm == "ada":
            return AdaBoostClassifier(**estimator_params)

        if algorithm == "lr":
            return LogisticRegression(**estimator_params)

        if algorithm == "nb":
            return GaussianNB(**estimator_params)

        if algorithm == "xgb":
            XGBClassifier = require_external_class("xgboost", "XGBClassifier", model_label="XGBoost")
            return XGBClassifier(**estimator_params)

        if algorithm == "lgbm":
            LGBMClassifier = require_external_class("lightgbm", "LGBMClassifier", model_label="LightGBM")
            return LGBMClassifier(**estimator_params)

        if algorithm == "catboost":
            CatBoostClassifier = require_external_class("catboost", "CatBoostClassifier", model_label="CatBoost")
            return CatBoostClassifier(**estimator_params)

        raise PipelineError(f"Unsupported model '{algorithm}'.", status_code=400)

    def to_estimator_params(
        self,
        algorithm: str,
        params: dict[str, Any],
        *,
        class_count: int = 2,
        problem_type: str = "classification",
    ) -> dict[str, Any]:
        if problem_type == "regression":
            if algorithm == "knn":
                return {
                    "n_neighbors": int(params["k"]),
                    "weights": str(params["weights"]),
                    "p": int(params["p"]),
                }

            if algorithm == "svm":
                return {
                    "C": float(params["c"]),
                    "kernel": str(params["kernel"]),
                    "gamma": str(params["gamma"]),
                    "degree": int(params["degree"]),
                    "epsilon": float(params["epsilon"]),
                }

            if algorithm == "dt":
                return {
                    "criterion": str(params["criterion"]),
                    "max_depth": int(params["max_depth"]),
                    "min_samples_split": int(params["min_samples_split"]),
                    "min_samples_leaf": int(params["min_samples_leaf"]),
                    "random_state": 42,
                }

            if algorithm in {"rf", "et"}:
                max_features = None if params["max_features"] == "all" else str(params["max_features"])
                return {
                    "n_estimators": int(params["n_estimators"]),
                    "max_depth": int(params["max_depth"]),
                    "min_samples_split": int(params["min_samples_split"]),
                    "min_samples_leaf": int(params["min_samples_leaf"]),
                    "max_features": max_features,
                    "bootstrap": bool(params["bootstrap"]),
                    "random_state": 42,
                    "n_jobs": 1,
                }

            if algorithm == "ada":
                return {
                    "n_estimators": int(params["n_estimators"]),
                    "learning_rate": float(params["learning_rate"]),
                    "estimator": DecisionTreeRegressor(max_depth=int(params["estimator_depth"]), random_state=42),
                    "random_state": 42,
                }

            if algorithm == "lr":
                return {
                    "fit_intercept": bool(params["fit_intercept"]),
                    "n_jobs": 1,
                }

            if algorithm == "nb":
                return {
                    "alpha": float(params["alpha"]),
                    "random_state": 42,
                }

            if algorithm == "xgb":
                return {
                    "n_estimators": int(params["n_estimators"]),
                    "max_depth": int(params["max_depth"]),
                    "learning_rate": float(params["learning_rate"]),
                    "subsample": float(params["subsample"]),
                    "colsample_bytree": float(params["colsample_bytree"]),
                    "reg_lambda": float(params["reg_lambda"]),
                    "objective": "reg:squarederror",
                    "random_state": 42,
                    "n_jobs": 1,
                    "tree_method": "hist",
                    "verbosity": 0,
                }

            if algorithm == "lgbm":
                return {
                    "n_estimators": int(params["n_estimators"]),
                    "max_depth": int(params["max_depth"]),
                    "learning_rate": float(params["learning_rate"]),
                    "num_leaves": int(params["num_leaves"]),
                    "subsample": float(params["subsample"]),
                    "colsample_bytree": float(params["colsample_bytree"]),
                    "objective": "regression",
                    "random_state": 42,
                    "n_jobs": 1,
                    "verbosity": -1,
                }

            if algorithm == "catboost":
                return {
                    "iterations": int(params["iterations"]),
                    "depth": int(params["depth"]),
                    "learning_rate": float(params["learning_rate"]),
                    "l2_leaf_reg": float(params["l2_leaf_reg"]),
                    "loss_function": "RMSE",
                    "allow_writing_files": False,
                    "random_seed": 42,
                    "verbose": False,
                }

        if algorithm == "knn":
            return {
                "n_neighbors": int(params["k"]),
                "weights": str(params["weights"]),
                "p": int(params["p"]),
            }

        if algorithm == "svm":
            class_weight = None if params["class_weight"] == "none" else str(params["class_weight"])
            return {
                "C": float(params["c"]),
                "kernel": str(params["kernel"]),
                "gamma": str(params["gamma"]),
                "degree": int(params["degree"]),
                "class_weight": class_weight,
                "probability": True,
                "random_state": 42,
            }

        if algorithm == "dt":
            class_weight = None if params["class_weight"] == "none" else str(params["class_weight"])
            return {
                "criterion": str(params["criterion"]),
                "max_depth": int(params["max_depth"]),
                "min_samples_split": int(params["min_samples_split"]),
                "min_samples_leaf": int(params["min_samples_leaf"]),
                "class_weight": class_weight,
                "random_state": 42,
            }

        if algorithm in {"rf", "et"}:
            class_weight = None if params["class_weight"] == "none" else str(params["class_weight"])
            max_features = None if params["max_features"] == "all" else str(params["max_features"])
            shared_params = {
                "criterion": str(params["criterion"]),
                "n_estimators": int(params["n_estimators"]),
                "max_depth": int(params["max_depth"]),
                "min_samples_split": int(params["min_samples_split"]),
                "min_samples_leaf": int(params["min_samples_leaf"]),
                "max_features": max_features,
                "bootstrap": bool(params["bootstrap"]),
                "class_weight": class_weight,
                "random_state": 42,
                "n_jobs": 1,
            }
            return shared_params

        if algorithm == "ada":
            return {
                "n_estimators": int(params["n_estimators"]),
                "learning_rate": float(params["learning_rate"]),
                "estimator": DecisionTreeClassifier(max_depth=int(params["estimator_depth"]), random_state=42),
                "random_state": 42,
            }

        if algorithm == "lr":
            class_weight = None if params["class_weight"] == "none" else str(params["class_weight"])
            return {
                "C": float(params["c"]),
                "max_iter": int(params["max_iter"]),
                "class_weight": class_weight,
                "random_state": 42,
                "solver": "lbfgs",
            }

        if algorithm == "nb":
            return {
                "var_smoothing": float(params["var_smoothing"]),
            }

        if algorithm == "xgb":
            objective = "multi:softprob" if class_count > 2 else "binary:logistic"
            estimator_params = {
                "n_estimators": int(params["n_estimators"]),
                "max_depth": int(params["max_depth"]),
                "learning_rate": float(params["learning_rate"]),
                "subsample": float(params["subsample"]),
                "colsample_bytree": float(params["colsample_bytree"]),
                "reg_lambda": float(params["reg_lambda"]),
                "objective": objective,
                "eval_metric": "mlogloss" if class_count > 2 else "logloss",
                "random_state": 42,
                "n_jobs": 1,
                "tree_method": "hist",
                "verbosity": 0,
            }
            if class_count > 2:
                estimator_params["num_class"] = int(class_count)
            return estimator_params

        if algorithm == "lgbm":
            estimator_params = {
                "n_estimators": int(params["n_estimators"]),
                "max_depth": int(params["max_depth"]),
                "learning_rate": float(params["learning_rate"]),
                "num_leaves": int(params["num_leaves"]),
                "subsample": float(params["subsample"]),
                "colsample_bytree": float(params["colsample_bytree"]),
                "objective": "multiclass" if class_count > 2 else "binary",
                "random_state": 42,
                "n_jobs": 1,
                "verbosity": -1,
            }
            if class_count > 2:
                estimator_params["num_class"] = int(class_count)
            return estimator_params

        if algorithm == "catboost":
            return {
                "iterations": int(params["iterations"]),
                "depth": int(params["depth"]),
                "learning_rate": float(params["learning_rate"]),
                "l2_leaf_reg": float(params["l2_leaf_reg"]),
                "loss_function": "MultiClass" if class_count > 2 else "Logloss",
                "allow_writing_files": False,
                "random_seed": 42,
                "verbose": False,
            }

        raise PipelineError(f"Unsupported model '{algorithm}'.", status_code=400)

    def to_model_params(
        self,
        algorithm: str,
        estimator_params: dict[str, Any],
        *,
        problem_type: str = "classification",
    ) -> dict[str, Any]:
        if problem_type == "regression":
            if algorithm == "knn":
                return {
                    "k": int(estimator_params["n_neighbors"]),
                    "weights": str(estimator_params["weights"]),
                    "p": int(estimator_params["p"]),
                }

            if algorithm == "svm":
                return {
                    "c": float(estimator_params["C"]),
                    "kernel": str(estimator_params["kernel"]),
                    "gamma": str(estimator_params["gamma"]),
                    "degree": int(estimator_params["degree"]),
                    "epsilon": float(estimator_params["epsilon"]),
                }

            if algorithm == "dt":
                return {
                    "criterion": str(estimator_params["criterion"]),
                    "max_depth": int(estimator_params["max_depth"]),
                    "min_samples_split": int(estimator_params["min_samples_split"]),
                    "min_samples_leaf": int(estimator_params["min_samples_leaf"]),
                }

            if algorithm in {"rf", "et"}:
                return {
                    "n_estimators": int(estimator_params["n_estimators"]),
                    "max_depth": int(estimator_params["max_depth"]),
                    "min_samples_split": int(estimator_params["min_samples_split"]),
                    "min_samples_leaf": int(estimator_params["min_samples_leaf"]),
                    "max_features": "all" if estimator_params.get("max_features") is None else str(estimator_params["max_features"]),
                    "bootstrap": bool(estimator_params["bootstrap"]),
                }

            if algorithm == "ada":
                estimator = estimator_params.get("estimator")
                estimator_depth = estimator.max_depth if estimator is not None and hasattr(estimator, "max_depth") else estimator_params.get("estimator__max_depth", 4)
                return {
                    "n_estimators": int(estimator_params["n_estimators"]),
                    "learning_rate": float(estimator_params["learning_rate"]),
                    "estimator_depth": int(estimator_depth),
                }

            if algorithm == "lr":
                return {
                    "fit_intercept": bool(estimator_params.get("fit_intercept", True)),
                }

            if algorithm == "nb":
                return {
                    "alpha": float(estimator_params["alpha"]),
                }

            if algorithm == "xgb":
                return {
                    "n_estimators": int(estimator_params["n_estimators"]),
                    "max_depth": int(estimator_params["max_depth"]),
                    "learning_rate": float(estimator_params["learning_rate"]),
                    "subsample": float(estimator_params["subsample"]),
                    "colsample_bytree": float(estimator_params["colsample_bytree"]),
                    "reg_lambda": float(estimator_params["reg_lambda"]),
                }

            if algorithm == "lgbm":
                return {
                    "n_estimators": int(estimator_params["n_estimators"]),
                    "max_depth": int(estimator_params["max_depth"]),
                    "learning_rate": float(estimator_params["learning_rate"]),
                    "num_leaves": int(estimator_params["num_leaves"]),
                    "subsample": float(estimator_params["subsample"]),
                    "colsample_bytree": float(estimator_params["colsample_bytree"]),
                }

            if algorithm == "catboost":
                return {
                    "iterations": int(estimator_params["iterations"]),
                    "depth": int(estimator_params["depth"]),
                    "learning_rate": float(estimator_params["learning_rate"]),
                    "l2_leaf_reg": float(estimator_params["l2_leaf_reg"]),
                }

        if algorithm == "knn":
            return {
                "k": int(estimator_params["n_neighbors"]),
                "weights": str(estimator_params["weights"]),
                "p": int(estimator_params["p"]),
            }

        if algorithm == "svm":
            return {
                "c": float(estimator_params["C"]),
                "kernel": str(estimator_params["kernel"]),
                "gamma": str(estimator_params["gamma"]),
                "degree": int(estimator_params["degree"]),
                "class_weight": "none" if estimator_params.get("class_weight") is None else str(estimator_params["class_weight"]),
            }

        if algorithm == "dt":
            return {
                "criterion": str(estimator_params["criterion"]),
                "max_depth": int(estimator_params["max_depth"]),
                "min_samples_split": int(estimator_params["min_samples_split"]),
                "min_samples_leaf": int(estimator_params["min_samples_leaf"]),
                "class_weight": "none" if estimator_params.get("class_weight") is None else str(estimator_params["class_weight"]),
            }

        if algorithm in {"rf", "et"}:
            return {
                "criterion": str(estimator_params["criterion"]),
                "n_estimators": int(estimator_params["n_estimators"]),
                "max_depth": int(estimator_params["max_depth"]),
                "min_samples_split": int(estimator_params["min_samples_split"]),
                "min_samples_leaf": int(estimator_params["min_samples_leaf"]),
                "max_features": "all" if estimator_params.get("max_features") is None else str(estimator_params["max_features"]),
                "bootstrap": bool(estimator_params["bootstrap"]),
                "class_weight": "none" if estimator_params.get("class_weight") is None else str(estimator_params["class_weight"]),
            }

        if algorithm == "ada":
            estimator = estimator_params.get("estimator")
            estimator_depth = estimator.max_depth if estimator is not None and hasattr(estimator, "max_depth") else estimator_params.get("estimator__max_depth", 1)
            return {
                "n_estimators": int(estimator_params["n_estimators"]),
                "learning_rate": float(estimator_params["learning_rate"]),
                "estimator_depth": int(estimator_depth),
            }

        if algorithm == "lr":
            return {
                "c": float(estimator_params["C"]),
                "max_iter": int(estimator_params["max_iter"]),
                "class_weight": "none" if estimator_params.get("class_weight") is None else str(estimator_params["class_weight"]),
            }

        if algorithm == "nb":
            return {
                "var_smoothing": float(estimator_params["var_smoothing"]),
            }

        if algorithm == "xgb":
            return {
                "n_estimators": int(estimator_params["n_estimators"]),
                "max_depth": int(estimator_params["max_depth"]),
                "learning_rate": float(estimator_params["learning_rate"]),
                "subsample": float(estimator_params["subsample"]),
                "colsample_bytree": float(estimator_params["colsample_bytree"]),
                "reg_lambda": float(estimator_params["reg_lambda"]),
            }

        if algorithm == "lgbm":
            return {
                "n_estimators": int(estimator_params["n_estimators"]),
                "max_depth": int(estimator_params["max_depth"]),
                "learning_rate": float(estimator_params["learning_rate"]),
                "num_leaves": int(estimator_params["num_leaves"]),
                "subsample": float(estimator_params["subsample"]),
                "colsample_bytree": float(estimator_params["colsample_bytree"]),
            }

        if algorithm == "catboost":
            return {
                "iterations": int(estimator_params["iterations"]),
                "depth": int(estimator_params["depth"]),
                "learning_rate": float(estimator_params["learning_rate"]),
                "l2_leaf_reg": float(estimator_params["l2_leaf_reg"]),
            }

        raise PipelineError(f"Unsupported model '{algorithm}'.", status_code=400)
