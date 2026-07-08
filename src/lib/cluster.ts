// A tiny fake Kubernetes cluster with one live incident: portfolio-web is
// CrashLoopBackOff (OOMKilled at a 64Mi limit). Diagnose with logs/describe,
// fix with `kubectl set resources` or `kubectl edit` (in vim), then watch
// the rollout. State resets each session; survives `clear`.

const ROLLOUT_MS = 8000;

export interface ClusterState {
  createdAt: number;
  suffix: string; // replicaset hash for this session
  crashId: string; // pod id of the crashing replica
  memLimitMi: number;
  fixedAt: number | null; // when a valid fix was applied
  firstTouchAt: number | null; // first kubectl command (MTTR start)
  celebrated: boolean; // 🎉 printed?
  deletions: number; // how many times they tried deleting the pod
}

const rand = (n: number) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + n);

export let cluster: ClusterState = newCluster();

function newCluster(): ClusterState {
  return {
    createdAt: Date.now(),
    suffix: rand(5),
    crashId: rand(5),
    memLimitMi: 64,
    fixedAt: null,
    firstTouchAt: null,
    celebrated: false,
    deletions: 0
  };
}

export function resetCluster(): void {
  cluster = newCluster();
}

export function touchCluster(): void {
  if (cluster.firstTouchAt === null) cluster.firstTouchAt = Date.now();
}

export type Phase = 'broken' | 'rolling' | 'healthy';

export function phase(): Phase {
  if (cluster.fixedAt === null) return 'broken';
  return Date.now() - cluster.fixedAt < ROLLOUT_MS ? 'rolling' : 'healthy';
}

// Apply a memory-limit change. ≥128Mi actually fixes it.
export function setMemLimit(mi: number): 'fixed' | 'still-broken' {
  cluster.memLimitMi = mi;
  if (mi >= 128 && cluster.fixedAt === null) {
    cluster.fixedAt = Date.now();
    return 'fixed';
  }
  return mi >= 128 ? 'fixed' : 'still-broken';
}

// Deleting the crashing pod: the Deployment replaces it (still crashing).
export function respawnCrashPod(): string {
  cluster.crashId = rand(5);
  cluster.deletions++;
  return crashPodName();
}

export const crashPodName = () => `portfolio-web-${cluster.suffix}-${cluster.crashId}`;

export function mttr(): string {
  const start = cluster.firstTouchAt ?? cluster.createdAt;
  const end = cluster.fixedAt !== null ? cluster.fixedAt + ROLLOUT_MS : Date.now();
  const secs = Math.max(1, Math.round((end - start) / 1000));
  const m = Math.floor(secs / 60);
  return m > 0 ? `${m}m ${secs % 60}s` : `${secs}s`;
}

export interface PodRow {
  name: string;
  ready: string;
  status: string;
  restarts: number;
  age: string;
}

function ageStr(baseMin: number): string {
  const extra = Math.floor((Date.now() - cluster.createdAt) / 60000);
  const min = baseMin + extra;
  if (min < 60) return `${min}m`;
  if (min < 60 * 48) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
}

export function pods(): PodRow[] {
  const p = phase();
  const s = cluster.suffix;
  const crashRestarts = 7 + Math.floor((Date.now() - cluster.createdAt) / 90_000);
  const crashRow: PodRow =
    p === 'broken'
      ? {
          name: crashPodName(),
          ready: '0/1',
          status: 'CrashLoopBackOff',
          restarts: crashRestarts,
          age: cluster.deletions ? ageStr(0) : ageStr(12)
        }
      : p === 'rolling'
        ? {
            name: `portfolio-web-${s}-${cluster.crashId}`,
            ready: '0/1',
            status: 'ContainerCreating',
            restarts: 0,
            age: '2s'
          }
        : {
            name: `portfolio-web-${s}-${cluster.crashId}`,
            ready: '1/1',
            status: 'Running',
            restarts: 0,
            age: ageStr(0)
          };
  return [
    {
      name: `portfolio-web-${s}-k4x2p`,
      ready: '1/1',
      status: 'Running',
      restarts: 0,
      age: ageStr(3 * 1440)
    },
    crashRow,
    {
      name: 'nginx-ingress-7f6b9-w8s1q',
      ready: '1/1',
      status: 'Running',
      restarts: 1,
      age: ageStr(12 * 1440)
    },
    {
      name: 'redis-cache-5d8c7-m3n9r',
      ready: '1/1',
      status: 'Running',
      restarts: 0,
      age: ageStr(9 * 1440)
    },
    {
      name: 'metrics-agent-9k2df-t7v4x',
      ready: '1/1',
      status: 'Running',
      restarts: 2,
      age: ageStr(21 * 1440)
    },
    {
      name: 'cert-manager-6b5a8-q1z8w',
      ready: '1/1',
      status: 'Running',
      restarts: 0,
      age: ageStr(30 * 1440)
    }
  ];
}

export function crashLogs(): string {
  return [
    '2026/07/07 14:02:11 starting portfolio-web v2.4.1',
    '2026/07/07 14:02:11 loading render cache into memory...',
    '2026/07/07 14:02:12 cache size: 61MiB and growing',
    'fatal error: runtime: out of memory',
    '',
    'goroutine 1 [running]:',
    'runtime.throw({0x8b4c2e?, 0x40e9c5?})',
    '        /usr/lib/go/src/runtime/panic.go:1023 +0x5c',
    'runtime.sysMapOS(0xc000400000, 0x4000000?)',
    '        /usr/lib/go/src/runtime/mem_linux.go:167 +0x11b',
    '',
    `OOMKilled: container exceeded memory limit (${cluster.memLimitMi}Mi)`
  ].join('\n');
}

export function describeCrashPod(): string {
  const restarts = 7 + Math.floor((Date.now() - cluster.createdAt) / 90_000);
  return [
    `Name:             ${crashPodName()}`,
    'Namespace:        default',
    'Node:             homelab-node-1/192.168.1.10',
    'Status:           Running',
    'Controlled By:    ReplicaSet/portfolio-web-' + cluster.suffix,
    'Containers:',
    '  web:',
    '    Image:          registry.local/portfolio-web:2.4.1',
    '    State:          Waiting',
    '      Reason:       CrashLoopBackOff',
    '    Last State:     Terminated',
    '      Reason:       OOMKilled',
    '      Exit Code:    137',
    '    Restart Count:  ' + restarts,
    '    Limits:',
    `      memory:  ${cluster.memLimitMi}Mi        <-- suspicious, no?`,
    '    Requests:',
    '      cpu:     100m',
    '      memory:  32Mi',
    'Events:',
    '  Type     Reason     Age                  Message',
    '  ----     ------     ----                 -------',
    '  Normal   Pulled     2m (x' + restarts + ' over 12m)   Container image already present',
    '  Warning  BackOff    30s (x' +
      restarts * 3 +
      ' over 11m)  Back-off restarting failed container',
    `  Warning  OOMKilling 45s                  Memory cgroup out of memory: Killed process (web)`
  ].join('\n');
}

export const DEPLOY_MANIFEST = [
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: portfolio-web',
  '  namespace: default',
  'spec:',
  '  replicas: 2',
  '  selector:',
  '    matchLabels:',
  '      app: portfolio-web',
  '  template:',
  '    metadata:',
  '      labels:',
  '        app: portfolio-web',
  '    spec:',
  '      containers:',
  '        - name: web',
  '          image: registry.local/portfolio-web:2.4.1',
  '          ports:',
  '            - containerPort: 80',
  '          resources:',
  '            requests:',
  '              cpu: 100m',
  '              memory: 32Mi',
  '            limits:',
  '              memory: 64Mi'
];

// Pull the limits.memory value out of an edited manifest (last memory under limits).
export function parseManifestLimit(content: string): number | null {
  const m = content.match(/limits:[\s\S]*?memory:\s*(\d+)(Mi|Gi)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase() === 'gi' ? n * 1024 : n;
}
