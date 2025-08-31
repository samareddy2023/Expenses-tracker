import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  User,
  Expense,
  Theme,
  Category,
  SortOption,
  PaymentMethod,
} from './types';
import { CATEGORIES, DEFAULT_USER, PAYMENT_METHODS } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import { getSavingTips, extractExpenseFromImage } from './services/geminiService';
import {
  PlusIcon, SunIcon, MoonIcon, UserCircleIcon, PencilIcon, TrashIcon,
  DownloadIcon, ShareIcon, LightbulbIcon, XMarkIcon, UploadIcon, DocumentChartBarIcon
} from './components/icons';
import { CategoryPieChart, WeeklyTrendChart } from './components/Charts';


// Helper to get formatted date string
const getFormattedDate = (date: Date | string = new Date()) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

// Main App Component
export default function App() {
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', []);
  const [user, setUser] = useLocalStorage<User>('user', DEFAULT_USER);
  const [theme, setTheme] = useLocalStorage<Theme>('theme', Theme.Light);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [currentExpense, setCurrentExpense] = useState<Partial<Expense> | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [filterDate, setFilterDate] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.Latest);
  
  const [tips, setTips] = useState('');
  const [isTipsLoading, setIsTipsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (theme === Theme.Dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === Theme.Light ? Theme.Dark : Theme.Light);
  };

  const handleSaveExpense = (expenseToSave: Partial<Expense>) => {
    if (expenseToSave.id) {
        const updatedExpense = expenseToSave as Expense;
        setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
    } else {
        const newExpense: Expense = {
            id: new Date().toISOString(),
            date: expenseToSave.date || getFormattedDate(),
            category: expenseToSave.category || 'Other',
            amount: expenseToSave.amount || 0,
            description: expenseToSave.description || '',
            paymentMethod: expenseToSave.paymentMethod || 'UPI',
        };
        setExpenses(prev => [newExpense, ...prev]);
    }
  };
  
  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
        setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };
  
  const openExpenseModal = (expense: Partial<Expense> | null = null) => {
    setCurrentExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false);
    setCurrentExpense(null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const base64String = (reader.result as string).split(',')[1];
            const mimeType = file.type;
            
            const extractedData = await extractExpenseFromImage({ data: base64String, mimeType }, CATEGORIES);
            openExpenseModal(extractedData);
        } catch (error) {
            alert((error as Error).message);
        } finally {
            setIsScanning(false);
        }
    };
    reader.onerror = () => {
        alert('Failed to read file.');
        setIsScanning(false);
    };
    reader.readAsDataURL(file);
    
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleGenerateTips = useCallback(async () => {
    setIsTipsLoading(true);
    setIsTipsModalOpen(true);
    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        const today = new Date();
        return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
    });
    const result = await getSavingTips(monthlyExpenses);
    setTips(result);
    setIsTipsLoading(false);
  }, [expenses]);
  
  const handleDownloadPdf = () => {
    const reportElement = document.getElementById('report-content');
    if (reportElement) {
        html2canvas(reportElement, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`RupeeRoute_Dashboard_Report_${getFormattedDate()}.pdf`);
        });
    }
  };

  const shareReport = () => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const text = `Check out my expense report from RupeeRoute! Total expenses: ₹${total.toLocaleString('en-IN')}.`;
    if (navigator.share) {
      navigator.share({
        title: 'My Expense Report',
        text: text,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert('Share feature is not supported on your browser. You can copy this text:\n\n' + text);
    }
  };


  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(e => filterCategory === 'All' || e.category === filterCategory)
      .filter(e => !filterDate || e.date === filterDate)
      .sort((a, b) => {
        if (sortOption === SortOption.Amount) {
          return b.amount - a.amount;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [expenses, filterCategory, filterDate, sortOption]);
  
  const totalMonthlyExpenses = useMemo(() => {
    const today = new Date();
    return expenses
      .filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);
  
  const pieChartData = useMemo(() => {
    const categoryTotals: { [key in Category]?: number } = {};
    filteredExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value: value! }));
  }, [filteredExpenses]);

  const weeklyTrendData = useMemo(() => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        return {
            name: d.toLocaleDateString('en-US', { weekday: 'short' }),
            date: d.toISOString().split('T')[0],
            amount: 0
        };
    }).reverse();

    expenses.forEach(expense => {
        const day = last7Days.find(d => d.date === expense.date);
        if (day) day.amount += expense.amount;
    });
    return last7Days;
  }, [expenses]);
  
  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-200 transition-colors duration-300">
      <Header user={user} onProfileClick={() => setIsProfileModalOpen(true)} onThemeToggle={toggleTheme} theme={theme} />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <div id="report-content">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-300">Monthly Expenses</h2>
                            <p className="text-4xl font-extrabold text-primary-600">₹{totalMonthlyExpenses.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                            <button onClick={handleGenerateTips} className="flex items-center bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">
                                <LightbulbIcon className="h-5 w-5 mr-2" />
                                Get Tips
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} title="Upload a receipt, bill, or transaction screenshot to auto-fill details" className="flex items-center bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">
                                <UploadIcon className="h-5 w-5 mr-2" />
                                Add from Image
                            </button>
                            <button onClick={() => openExpenseModal()} className="flex items-center bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105">
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Add Manually
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md">
                    <h3 className="text-xl font-bold mb-4">Category Breakdown</h3>
                    {pieChartData.length > 0 ? <CategoryPieChart data={pieChartData} /> : <p className="text-center text-gray-500 dark:text-gray-400 py-16">No data for pie chart.</p>}
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md">
                    <h3 className="text-xl font-bold mb-4">Weekly Trend</h3>
                    <WeeklyTrendChart data={weeklyTrendData} />
                </div>
            </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h3 className="text-2xl font-bold">Expense History</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500"/>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as Category | 'All')} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500">
                        <option value="All">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500">
                        <option value="latest">Sort by Latest</option>
                        <option value="amount">Sort by Amount</option>
                    </select>
                    <button onClick={() => setIsReportModalOpen(true)} title="Generate Report" className="p-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"><DocumentChartBarIcon className="h-5 w-5"/></button>
                    <button onClick={handleDownloadPdf} title="Download Dashboard as PDF" className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"><DownloadIcon className="h-5 w-5"/></button>
                    <button onClick={shareReport} title="Share Dashboard Summary" className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"><ShareIcon className="h-5 w-5"/></button>
                </div>
            </div>
            <ExpenseTable expenses={filteredExpenses} onEdit={openExpenseModal} onDelete={handleDeleteExpense} />
        </div>
      </main>
      
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />

      {isScanning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-[100]">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
            <p className="text-white text-xl font-semibold">Analyzing image...</p>
        </div>
      )}

      {isExpenseModalOpen && <ExpenseFormModal initialData={currentExpense} onSave={handleSaveExpense} onClose={closeExpenseModal} />}
      {isProfileModalOpen && <ProfileModal user={user} onSave={setUser} onClose={() => setIsProfileModalOpen(false)} />}
      {isTipsModalOpen && <TipsModal content={tips} isLoading={isTipsLoading} onClose={() => setIsTipsModalOpen(false)} />}
      {isReportModalOpen && <ReportsModal expenses={expenses} onClose={() => setIsReportModalOpen(false)} />}
    </div>
  );
}


// --- Sub-Components --- //

const Header: React.FC<{ user: User, onProfileClick: () => void, onThemeToggle: () => void, theme: Theme }> = ({ user, onProfileClick, onThemeToggle, theme }) => (
    <header className="bg-white dark:bg-gray-800 shadow-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary-600">RupeeRoute</h1>
            <div className="flex items-center space-x-4">
                <button onClick={onThemeToggle} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                </button>
                <div className="flex items-center space-x-2 cursor-pointer" onClick={onProfileClick}>
                    <span className="font-semibold hidden md:block">Welcome, {user.name}</span>
                    {user.profilePicture ? 
                        <img src={user.profilePicture} alt="Profile" className="h-10 w-10 rounded-full object-cover"/> : 
                        <UserCircleIcon className="h-10 w-10 text-gray-400"/>
                    }
                </div>
            </div>
        </div>
    </header>
);

const ExpenseTable: React.FC<{ expenses: Expense[], onEdit?: (expense: Expense) => void, onDelete?: (id: string) => void, isReport?: boolean }> = ({ expenses, onEdit, onDelete, isReport = false }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead className="border-b dark:border-gray-600">
                <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount</th>
                    {!isReport && <th className="p-3 text-center">Actions</th>}
                </tr>
            </thead>
            <tbody>
                {expenses.length > 0 ? expenses.map(e => (
                    <tr key={e.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3">{e.date}</td>
                        <td className="p-3">
                           <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300">{e.category}</span> 
                        </td>
                        <td className="p-3">{e.paymentMethod}</td>
                        <td className="p-3 max-w-xs truncate">{e.description}</td>
                        <td className="p-3 text-right font-mono">₹{e.amount.toLocaleString('en-IN')}</td>
                        {!isReport && (
                            <td className="p-3 text-center">
                                <button onClick={() => onEdit?.(e)} className="text-blue-500 hover:text-blue-700 p-1"><PencilIcon className="h-5 w-5"/></button>
                                <button onClick={() => onDelete?.(e.id)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-5 w-5"/></button>
                            </td>
                        )}
                    </tr>
                )) : (
                    <tr><td colSpan={isReport ? 5 : 6} className="text-center p-8 text-gray-500">No expenses found for this period.</td></tr>
                )}
            </tbody>
        </table>
    </div>
);

const ExpenseFormModal: React.FC<{ initialData: Partial<Expense> | null, onSave: (expense: Partial<Expense>) => void, onClose: () => void }> = ({ initialData, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        date: initialData?.date || getFormattedDate(),
        category: initialData?.category || CATEGORIES[0],
        amount: initialData?.amount || '',
        description: initialData?.description || '',
        paymentMethod: initialData?.paymentMethod || 'UPI',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? (value ? parseFloat(value) : '') : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expenseData = {
            ...initialData,
            ...formData,
            amount: Number(formData.amount),
        };
        onSave(expenseData);
        onClose();
    };

    return (
        <Modal title={initialData?.id ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-1 font-medium">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                </div>
                 <div>
                    <label className="block mb-1 font-medium">Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} required className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block mb-1 font-medium">Payment Method</label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} required className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block mb-1 font-medium">Amount (₹)</label>
                    <input type="number" name="amount" value={formData.amount} onChange={handleChange} required min="0.01" step="0.01" placeholder="e.g., 500.50" className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                </div>
                 <div>
                    <label className="block mb-1 font-medium">Description</label>
                    <input type="text" name="description" value={formData.description} onChange={handleChange} required placeholder="e.g., Lunch with friends" className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                    <button type="submit" className="py-2 px-4 rounded bg-primary-500 hover:bg-primary-600 text-white font-semibold">{initialData?.id ? 'Save Changes' : 'Add Expense'}</button>
                </div>
            </form>
        </Modal>
    );
};

const ProfileModal: React.FC<{ user: User, onSave: (user: User) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [name, setName] = useState(user.name);
    const [picture, setPicture] = useState(user.profilePicture);

    const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPicture(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, profilePicture: picture });
        onClose();
    };

    return (
        <Modal title="Edit Profile" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col items-center">
                    {picture ? 
                        <img src={picture} alt="Profile" className="h-24 w-24 rounded-full object-cover mb-2" /> :
                        <UserCircleIcon className="h-24 w-24 text-gray-400 mb-2"/>
                    }
                    <input type="file" accept="image/*" onChange={handlePictureUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"/>
                </div>
                <div>
                    <label className="block mb-1 font-medium">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                    <button type="submit" className="py-2 px-4 rounded bg-primary-500 hover:bg-primary-600 text-white font-semibold">Save Profile</button>
                </div>
            </form>
        </Modal>
    );
};

const TipsModal: React.FC<{ content: string, isLoading: boolean, onClose: () => void }> = ({ content, isLoading, onClose }) => (
    <Modal title="Smart Savings Tips" onClose={onClose}>
        {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        ) : (
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                {content.split('\n').map((line, index) => {
                    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                        return <p key={index} className="pl-4 relative before:content-['•'] before:absolute before:left-0">{line.substring(2)}</p>
                    }
                    return <p key={index}>{line}</p>;
                })}
            </div>
        )}
    </Modal>
);

const ReportsModal: React.FC<{ expenses: Expense[]; onClose: () => void }> = ({ expenses, onClose }) => {
    type Report = { title: string; expenses: Expense[] };
    const [report, setReport] = useState<Report | null>(null);

    const generateReport = (period: 'this-week' | 'last-week' | 'this-month' | 'last-month') => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = new Date(now);
        let title = '';

        switch (period) {
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                title = `Report for ${now.toLocaleString('default', { month: 'long' })}`;
                break;
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                title = `Report for ${startDate.toLocaleString('default', { month: 'long' })}`;
                break;
            case 'this-week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay()); // Assuming week starts on Sunday
                title = 'This Week Report';
                break;
            case 'last-week':
                endDate = new Date(now);
                endDate.setDate(now.getDate() - now.getDay() - 1);
                startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 6);
                title = 'Last Week Report';
                break;
        }

        const startStr = getFormattedDate(startDate);
        const endStr = getFormattedDate(endDate);

        const filteredExpenses = expenses.filter(e => e.date >= startStr && e.date <= endStr)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setReport({ title, expenses: filteredExpenses });
    };

    const handleClose = () => {
        setReport(null);
        onClose();
    };
    
    const pieData = useMemo(() => {
        if (!report) return [];
        const categoryTotals: { [key in Category]?: number } = {};
        report.expenses.forEach(e => {
          categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
        });
        return Object.entries(categoryTotals).map(([name, value]) => ({ name, value: value! }));
    }, [report]);

    const handleDownloadReportPdf = () => {
        if (!report) return;
        const reportElement = document.getElementById('report-view-content');
        if (reportElement) {
            html2canvas(reportElement, { scale: 2 }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`RupeeRoute_${report.title.replace(/\s/g, '_')}.pdf`);
            });
        }
    };
    
    const shareGeneratedReport = () => {
        if (!report) return;
        const total = report.expenses.reduce((sum, e) => sum + e.amount, 0);
        const text = `My RupeeRoute Expense Report (${report.title}): Totaling ₹${total.toLocaleString('en-IN')}.`;
        if (navigator.share) {
            navigator.share({ title: 'My Expense Report', text, url: window.location.href }).catch(console.error);
        } else {
            alert('Share feature not supported. You can copy this text:\n\n' + text);
        }
    };

    return (
        <Modal title={report ? report.title : "Generate Expense Report"} onClose={handleClose}>
            {!report ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => generateReport('this-month')} className="p-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors">This Month</button>
                    <button onClick={() => generateReport('last-month')} className="p-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors">Last Month</button>
                    <button onClick={() => generateReport('this-week')} className="p-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors">This Week</button>
                    <button onClick={() => generateReport('last-week')} className="p-4 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors">Last Week</button>
                </div>
            ) : (
                <div>
                    <div id="report-view-content" className="p-4">
                        <div className="text-center mb-4">
                            <p className="text-xl font-bold text-gray-600 dark:text-gray-300">Total Expenses</p>
                            <p className="text-3xl font-extrabold text-primary-600">₹{report.expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}</p>
                        </div>
                        {pieData.length > 0 ? <CategoryPieChart data={pieData} /> : <p className="text-center text-gray-500 dark:text-gray-400 py-8">No expenses to display in a chart.</p>}
                        <h4 className="text-lg font-bold mt-6 mb-2">Transactions</h4>
                        <div className="max-h-64 overflow-y-auto">
                            <ExpenseTable expenses={report.expenses} isReport={true} />
                        </div>
                    </div>
                    <div className="flex justify-end items-center space-x-2 pt-4 mt-4 border-t dark:border-gray-700">
                        <button onClick={() => setReport(null)} className="py-2 px-4 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Back</button>
                        <button onClick={handleDownloadReportPdf} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"><DownloadIcon className="h-5 w-5"/></button>
                        <button onClick={shareGeneratedReport} className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"><ShareIcon className="h-5 w-5"/></button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><XMarkIcon className="h-6 w-6"/></button>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    </div>
);