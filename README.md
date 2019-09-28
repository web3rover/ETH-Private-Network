# Prerequisites

This tool assumes geth and bootnode executables are present in $PATH . If not, then follow the below commands to install:

```
git clone https://github.com/ethereum/go-ethereum.git
cd go-ethereum && make all
mv ./build/bin/* /usr/local/bin
```

# Getting Started

Before you can start running the script you need to install the dependencies. To install the dependencies, go to the project directory and run:

```
npm install
```

## Create new Network

To create a new Clique network run the below command:

```
npm run create
```

This will display a prompt asking for total number of authority and non-authority nodes you wish to setup. Along with that it will ask for block time and password for locking authority accounts. You can just skip to apply the default values which would create a network of 2 authority and 1 non-authority nodes. It prefunds authority accounts with 1000 ETH.

After the network is created and started it will display commands to attach to the nodes. Here is an example output:

```
? Enter total authority nodes ... 2
? Enter total peer nodes ... 1
? Enter password for ethereum accounts ... Password@123
? Enter block time ... 5
Successfully started the network with 2 authority and 1 peer nodes. Here are
commands to connect to running nodes:
Node 1 (Authority):
 IPC Attach: geth attach ./output/node1/geth.ipc
 RPC Endpoint: localhost:8546
Node 2 (Authority):
 IPC Attach: geth attach ./output/node2/geth.ipc
 RPC Endpoint: localhost:8547
Node 3 (Peer):
 IPC Attach: geth attach ./output/node3/geth.ipc
 RPC Endpoint: localhost:8548
```

## Stop Network

To stop the network, run the below command:

```
npm run stop
```

## Restart Network

To start a stopped network or restart running network, run the below command:

```
npm run restart
```

## Delete Network

If you want to stop and delete the network, run the below command:

```
npm run delete
```

