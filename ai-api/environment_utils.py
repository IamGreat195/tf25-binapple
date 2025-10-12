import joblib
import numpy as np

def load_env_model(path):
    return joblib.load(path)

def predict_env_yield(model, avg_temp, pesticides, rainfall):
    X = np.array([[avg_temp, pesticides, rainfall]])
    return float(model.predict(X)[0])
