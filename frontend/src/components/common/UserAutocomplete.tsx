import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { UserSummaryItem } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Search, User as UserIcon, X, Check, Loader2, Edit2 } from 'lucide-react';

export interface UserAutocompleteProps {
  value: string; // user ID or string representation
  onChange: (selectedUser: UserSummaryItem | null, stringVal?: string) => void;
  placeholder?: string;
  minChars?: number;
  disabled?: boolean;
  mode?: 'id' | 'string'; // 'id' matches by user.id, 'string' stores full_name or email
  allowCustomValue?: boolean;
  className?: string;
  autoFocus?: boolean;
  placement?: 'auto' | 'top' | 'bottom';
}

export const UserAutocomplete: React.FC<UserAutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  minChars = 3,
  disabled = false,
  mode = 'id',
  allowCustomValue = false,
  className = '',
  autoFocus = false,
  placement = 'auto'
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserSummaryItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummaryItem | null>(null);
  const [actualPlacement, setActualPlacement] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Initial lookup of selected user if mode is 'id' and value is present
  useEffect(() => {
    if (!value) {
      setSelectedUser(null);
      setQuery('');
      return;
    }

    if (mode === 'id') {
      if (selectedUser?.id !== value) {
        // Fetch or search to resolve user details
        api.searchUsers(value, 10).then((users) => {
          const match = users.find((u) => u.id === value);
          if (match) {
            setSelectedUser(match);
          } else if (users.length > 0) {
            setSelectedUser(users[0]);
          }
        }).catch(() => {
          // ignore lookup error
        });
      }
    } else {
      // mode is 'string'
      if (selectedUser && (selectedUser.full_name === value || selectedUser.email === value)) {
        // already resolved
      } else {
        setQuery(value);
      }
    }
  }, [value, mode]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute actual placement (top vs bottom) depending on available space
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    if (placement === 'top') {
      setActualPlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setActualPlacement('bottom');
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Se sotto mancano almeno 250px e sopra c'è più spazio, apri in alto
    if (spaceBelow < 250 && spaceAbove > 180) {
      setActualPlacement('top');
    } else {
      setActualPlacement('bottom');
    }
  }, [isOpen, placement, results.length]);

  // Search execution with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);

    if (allowCustomValue && mode === 'string') {
      onChange(null, text);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < minChars) {
      setResults([]);
      setLoading(false);
      setIsOpen(text.trim().length > 0);
      return;
    }

    setLoading(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.searchUsers(text.trim(), 20);
        setResults(data);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelectUser = (user: UserSummaryItem) => {
    setSelectedUser(user);
    setIsOpen(false);
    if (mode === 'id') {
      setQuery('');
      onChange(user, user.id);
    } else {
      setQuery(user.full_name || user.email);
      onChange(user, user.full_name || user.email);
    }
  };

  const handleClear = () => {
    setSelectedUser(null);
    setQuery('');
    setResults([]);
    onChange(null, '');
  };

  const displayPlaceholder = placeholder || t.common.searchUserPlaceholder;

  // If in 'id' mode and an user is already selected, render an elegant badge/card
  if (mode === 'id' && selectedUser && !isOpen) {
    return (
      <div
        className={`flex items-center justify-between p-2.5 bg-slate-50 border border-slate-300 rounded-xl transition ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-400'
        } ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 shadow-sm">
            {(selectedUser.full_name || selectedUser.username).slice(0, 2)}
          </div>
          <div className="truncate text-left">
            <span className="block font-bold text-xs text-slate-900 truncate">
              {selectedUser.full_name || selectedUser.username}
            </span>
            <span className="block text-[11px] text-slate-500 truncate">
              {selectedUser.email || `@${selectedUser.username}`}
            </span>
          </div>
        </div>

        {!disabled && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setQuery(selectedUser.full_name || selectedUser.username);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition text-xs font-semibold flex items-center gap-1"
              title={t.common.changeUserBtn}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
              title={t.common.clearUserBtn}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim().length >= minChars) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={displayPlaceholder}
          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition disabled:opacity-50"
        />

        {loading ? (
          <Loader2 className="w-4 h-4 text-indigo-600 absolute right-2.5 top-2.5 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-2 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100 ${
            actualPlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {query.trim().length < minChars ? (
            <div className="p-3 text-center text-xs text-slate-500 font-medium">
              💡 {t.common.typeToSearchHint.replace('{n}', String(minChars))}
            </div>
          ) : loading ? (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>{t.common.loadingUsers}</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              {t.common.noUsersFound} &ldquo;<span className="font-semibold text-slate-700">{query}</span>&rdquo;
            </div>
          ) : (
            results.map((u) => {
              const isSelected = selectedUser?.id === u.id || (mode === 'string' && (u.full_name === value || u.email === value));
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full p-2.5 text-left flex items-center justify-between gap-3 hover:bg-indigo-50/70 transition ${
                    isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                      {(u.full_name || u.username).slice(0, 2)}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                        <span>{u.full_name || u.username}</span>
                        {u.roles && u.roles.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {u.roles[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {u.email} &bull; <span className="font-mono text-slate-400">@{u.username}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
