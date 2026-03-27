import { getToken } from '../utils/storage';
import { BASE_URL } from './api';

export async function logFoodEntry(productName, calories) {
  const token = await getToken();
  if (!token) return null;

  const response = await fetch(`${BASE_URL}/food-log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      product_name: productName,
      calories: parseFloat(calories) || 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Unable to log food entry');
  }

  return response.json();
}
