import { useCallback, useEffect, useRef, useState } from "react";
import { browseFilesystem, getHomePath } from "../lib/api";
import type { DirEntry } from "../lib/types";

interface Props {
  initialPath?: string;
  onSelect: (path: string) => void;
}

export function DirectoryBrowser({ initialPath, onSelect }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [manualPath, setManualPath] = useState(initialPath || "");
  const initialized = useRef(false);

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFilter("");
    const resp = await browseFilesystem(path, 100);
    if (!resp.ok) {
      setError("Can't access this folder. It may not exist or lacks read permission.");
      setLoading(false);
      return;
    }
    // Success: update state even if empty (empty dir is valid)
    setEntries(resp.entries);
    setHasMore(resp.has_more);
    setCurrentPath(path);
    setManualPath(path);
    setLoading(false);
  }, []);

  // Discover and navigate to home dir on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (initialPath) {
      navigate(initialPath);
      return;
    }

    // Ask the server for the home directory path
    getHomePath().then((home) => {
      navigate(home || "/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pathSegments = currentPath.split("/").filter(Boolean);

  const goUp = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    navigate(parent);
  };

  const goToSegment = (index: number) => {
    const target = "/" + pathSegments.slice(0, index + 1).join("/");
    navigate(target);
  };

  const handleEntryClick = (entry: DirEntry) => {
    if (entry.is_git_repo) {
      onSelect(entry.path);
    } else {
      navigate(entry.path);
    }
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = manualPath.trim();
    if (p) navigate(p);
  };

  const filtered = filter
    ? entries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  // Breadcrumb truncation for mobile: show first + "..." + last 2
  const renderBreadcrumbs = () => {
    if (pathSegments.length <= 3) {
      return pathSegments.map((seg, i) => (
        <span key={i} className="flex items-center">
          <span className="text-text-dim mx-1">/</span>
          <button
            onClick={() => goToSegment(i)}
            className="text-text-secondary hover:text-text-primary cursor-pointer text-sm truncate max-w-[120px]"
          >
            {seg}
          </button>
        </span>
      ));
    }
    return (
      <>
        <span className="flex items-center">
          <span className="text-text-dim mx-1">/</span>
          <button onClick={() => goToSegment(0)} className="text-text-secondary hover:text-text-primary cursor-pointer text-sm">{pathSegments[0]}</button>
        </span>
        <span className="text-text-dim mx-1">/...</span>
        {pathSegments.slice(-2).map((seg, i) => (
          <span key={i} className="flex items-center">
            <span className="text-text-dim mx-1">/</span>
            <button
              onClick={() => goToSegment(pathSegments.length - 2 + i)}
              className="text-text-secondary hover:text-text-primary cursor-pointer text-sm truncate max-w-[120px]"
            >
              {seg}
            </button>
          </span>
        ))}
      </>
    );
  };

  return (
    <div>
      {/* Breadcrumbs + Use current folder button */}
      <div className="flex items-center justify-between mb-3 min-h-[28px]">
        <nav aria-label="Directory path" className="flex items-center flex-wrap gap-0.5">
          <button
            onClick={() => navigate(currentPath.split("/").slice(0, 2).join("/") || "/")}
            className="text-text-dim hover:text-text-secondary cursor-pointer text-sm"
            title="Go to home"
          >
            ~
          </button>
          {renderBreadcrumbs()}
        </nav>
        {currentPath && !loading && (
          <button
            onClick={() => onSelect(currentPath)}
            className="ml-2 shrink-0 px-2.5 py-1 text-xs rounded-md bg-brand-600/15 text-brand-400 hover:bg-brand-600/25 border border-brand-600/30 cursor-pointer transition-colors font-medium"
            title="Use this folder as project"
          >
            Use folder
          </button>
        )}
      </div>

      {/* Manual path input */}
      <form onSubmit={handleManualPathSubmit} className="flex gap-2 mb-3">
        <input
          type="text"
          value={manualPath}
          onChange={(e) => setManualPath(e.target.value)}
          placeholder="/path/to/folder"
          className="flex-1 bg-surface-900 border border-surface-700 rounded-md px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-dim focus:border-brand-600 focus:outline-none"
          aria-label="Manual path"
        />
        <button
          type="submit"
          className="px-3 py-2 text-sm bg-surface-700 hover:bg-surface-600 rounded-md text-text-secondary cursor-pointer transition-colors"
        >
          Go
        </button>
      </form>

      {/* Search/filter */}
      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Type to filter..."
          className="w-full bg-surface-900 border border-surface-700 rounded-md px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-dim focus:border-brand-600 focus:outline-none"
        />
      </div>

      {/* Directory listing */}
      <div className="border border-surface-700 rounded-lg overflow-hidden" role="listbox" aria-label="Directories">
        {loading ? (
          // Skeleton loading rows
          <div className="animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center px-3 h-[44px] border-b border-surface-800 last:border-0">
                <div className="w-5 h-5 bg-surface-700 rounded mr-3" />
                <div className="h-4 bg-surface-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-status-error mb-3">{error}</p>
            <button
              onClick={() => navigate(currentPath || "/")}
              className="text-sm text-brand-600 hover:text-brand-500 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Parent directory link */}
            {pathSegments.length > 1 && (
              <button
                onClick={goUp}
                className="flex items-center w-full px-3 h-[44px] text-left hover:bg-surface-700/50 cursor-pointer transition-colors border-b border-surface-800 text-text-dim"
                role="option"
              >
                <span className="w-5 mr-3 text-center">..</span>
                <span className="text-sm">(parent directory)</span>
              </button>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-text-dim">
                  {filter ? "No folders match your filter" : "No visible subfolders here"}
                </p>
                {!filter && (
                  <p className="text-xs text-text-dim mt-1">
                    Hidden folders (starting with .) are not shown
                  </p>
                )}
              </div>
            )}

            {/* Directory entries */}
            {filtered.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center w-full border-b border-surface-800 last:border-0"
                role="option"
              >
                <button
                  onClick={() => handleEntryClick(entry)}
                  className="flex items-center flex-1 min-w-0 px-3 h-[44px] text-left hover:bg-surface-700/50 cursor-pointer transition-colors"
                >
                  <span className="w-5 mr-3 text-center text-text-dim shrink-0">
                    {entry.is_git_repo ? (
                      <svg className="w-4 h-4 inline text-accent-600" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 1 1-.733.693L8.535 5.918v4.27a1.229 1.229 0 1 1-1.008-.036V5.847a1.224 1.224 0 0 1-.664-1.608L5.045 2.422l-4.743 4.743a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.031 1.031 0 0 0 0-1.457" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 inline text-text-dim" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-mono truncate ${entry.is_git_repo ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                    {entry.name}
                  </span>
                  {entry.is_git_repo && (
                    <span className="ml-auto mr-2 text-[10px] font-mono uppercase tracking-wider text-accent-600 bg-accent-600/10 px-1.5 py-0.5 rounded shrink-0">
                      repo
                    </span>
                  )}
                </button>
                {!entry.is_git_repo && (
                  <button
                    onClick={() => onSelect(entry.path)}
                    className="shrink-0 mr-2 px-2 py-1 text-[11px] rounded bg-surface-700/60 hover:bg-surface-600/80 text-text-dim hover:text-text-secondary border border-surface-700 cursor-pointer transition-colors"
                    title={`Use ${entry.name} as project folder`}
                  >
                    Use
                  </button>
                )}
              </div>
            ))}

            {hasMore && (
              <div className="px-3 py-2 text-center text-xs text-text-dim border-t border-surface-800">
                Showing first 100 entries. Use the filter to narrow results.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
