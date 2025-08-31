
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Expense } from '../types';
import { PIE_CHART_COLORS } from '../constants';

interface CategoryPieChartProps {
    data: { name: string; value: number }[];
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
    return (
        <div className="w-full h-64 md:h-80">
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

interface WeeklyTrendChartProps {
    data: { name: string; amount: number }[];
}

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({ data }) => {
    return (
        <div className="w-full h-64 md:h-80">
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="amount" fill="#3b82f6" name="Expenses" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
