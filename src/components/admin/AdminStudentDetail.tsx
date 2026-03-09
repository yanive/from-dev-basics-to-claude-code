import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { LEVELS, getLevelDisplayNumber } from '../../lib/constants';

interface Student {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
  lessonsCompleted: number;
}

interface ProgressRecord {
  lessonId: string;
  sectionIndex: number;
  completed: boolean;
  completedAt: string | null;
}

const totalLessons = LEVELS.reduce((sum, l) => sum + l.lessonCount, 0);

export function AdminStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiFetch('/api/admin/users').then(res => {
        if (!res.ok) throw new Error('Failed to load users');
        return res.json();
      }),
      apiFetch(`/api/admin/users/${id}/progress`).then(res => {
        if (!res.ok) throw new Error('Failed to load progress');
        return res.json();
      }),
    ])
      .then(([users, progressData]: [Student[], ProgressRecord[]]) => {
        const found = users.find(u => u.id === id);
        if (!found) {
          setError('Student not found');
          return;
        }
        setStudent(found);
        setProgress(progressData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-text-muted text-sm font-mono">Loading...</p>;
  }

  if (error) {
    return <p className="text-red text-sm">{error}</p>;
  }

  if (!student) {
    return <p className="text-text-muted text-sm font-mono">Student not found</p>;
  }

  const completedLessonIds = new Set(
    progress.filter(p => p.completed).map(p => p.lessonId)
  );

  const recentActivity = progress
    .filter(p => p.completed && p.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 20);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/students')}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-text-primary font-mono">{student.username}</h1>
            <RoleBadge role={student.role} />
          </div>
          <p className="text-sm text-text-muted">{student.displayName}</p>
        </div>
        {student.role === 'student' && (
          <button
            onClick={async () => {
              await startImpersonation(student.id);
              navigate('/');
            }}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 transition-colors"
          >
            Impersonate
          </button>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Completed"
          value={`${student.lessonsCompleted}/${totalLessons}`}
        />
        <StatCard label="Role" value={<RoleBadge role={student.role} />} />
        <StatCard
          label="Joined"
          value={new Date(student.createdAt).toLocaleDateString()}
        />
      </div>

      {/* Progress by Level */}
      <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Progress by Level</h2>
      <div className="space-y-4 mb-8">
        {LEVELS.map(level => {
          const levelLessons = Array.from({ length: level.lessonCount }, (_, i) => `${level.lessonPrefix}.${i + 1}`);
          const completedInLevel = levelLessons.filter(lid => completedLessonIds.has(lid)).length;

          return (
            <div key={level.id} className="bg-bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-text-primary">
                  L{getLevelDisplayNumber(level.id)}: {level.title}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {completedInLevel}/{level.lessonCount}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {levelLessons.map(lessonId => {
                  const isCompleted = completedLessonIds.has(lessonId);
                  return (
                    <div
                      key={lessonId}
                      className="flex items-center gap-1 text-xs font-mono"
                      title={lessonId}
                    >
                      {isCompleted ? (
                        <span className="text-green">&#10003;</span>
                      ) : (
                        <span className="text-text-muted">&#8212;</span>
                      )}
                      <span className={isCompleted ? 'text-text-primary' : 'text-text-muted'}>
                        {lessonId}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity timeline */}
      <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Recent Activity</h2>
      {recentActivity.length === 0 ? (
        <p className="text-text-muted text-sm font-mono">No completed lessons yet</p>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                  Lesson
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((record, idx) => (
                <tr key={`${record.lessonId}-${idx}`} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-text-primary">{record.lessonId}</td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    {new Date(record.completedAt!).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{label}</p>
      <div className="text-lg font-semibold text-text-primary font-mono mt-1">{value}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
        isAdmin
          ? 'bg-purple/20 text-purple'
          : 'bg-bg-elevated text-text-muted'
      }`}
    >
      {role}
    </span>
  );
}
