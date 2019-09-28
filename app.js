const { prompt } = require('inquirer');
const Web3 = require('web3');
const program = require('commander');
const shell = require('shelljs');
const fs = require('fs')
const Wallet = require('ethereumjs-wallet');
const EthUtil = require('ethereumjs-util');
const spawn = require('child_process').spawn;

const web3 = new Web3();
const outputDir = './output'

// Executes a command
const executeCommand = async (cmd) => {
  if (shell.exec(cmd, { silent: true }).code !== 0) {
    return Promise.reject();
  } else {
    return Promise.resolve();
  }
}

// Starts a background process and detaches from parent
const startBGProcess = (cmd, args, logPath) => {

  const out = logPath ? fs.openSync(logPath, 'a') : 'ignore';
  const err = logPath ? fs.openSync(logPath, 'a') : 'ignore';
  
  spawn( cmd, args, { detached: true, stdio: [ 'ignore', out, err ] }).unref()
}

// Creates and returns genesis for Clique PoA
const generateGenesis = (blockTime, authorityAccounts, prefundAccounts) => {
  
  let genesis = {
    config: {
      chainId: 1515,
      homesteadBlock: 0,
      eip150Block: 0,
      eip150Hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      clique: {
        period: blockTime,
        epoch: 30000
      }
    },
    nonce: '0x0',
    timestamp: '0x5d298ced',
    gasLimit: '0x47b760',
    difficulty: '0x1',
    mixHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    coinbase: '0x0000000000000000000000000000000000000000',
    alloc: {},
    number: '0x0',
    gasUsed: '0x0',
    parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
  };

  prefundAccounts.forEach(account => {
    genesis.alloc[account] = {
        balance: web3.utils.toHex(web3.utils.toWei('1000', 'ether'))
    } 
  })

  let concatenatedAuthorityAccounts = '';
  authorityAccounts.forEach(account => concatenatedAuthorityAccounts += account.substring(2))
  genesis.extraData = `0x0000000000000000000000000000000000000000000000000000000000000000${concatenatedAuthorityAccounts}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`

  return JSON.stringify(genesis, null, 2)
};

// Deletes the node's files and processes
let resetNetwork = _ => {
  shell.rm('-rf', outputDir);
  shell.mkdir('-p', outputDir);
  shell.cd(outputDir);
  shell.exec('pkill bootnode && pkill geth');
}

// Kills the running nodes
let stopNetwork = _ => {
  shell.cd(outputDir);
  shell.exec('pkill bootnode && pkill geth');
}

// Initializes a new network
let initNetwork = async (authorities, peers, password, blockTime) => {
  try {
    const totalNodes = authorities + peers;

    // Create directories for nodes
    for(let count = 1; count <= totalNodes; count++) {
      shell.mkdir('-p', `node${count}`);
    }

    let authorityAccounts = [];

    // Create password file for unlocking accounts
    fs.writeFileSync('password.txt', password, 'utf8');

    //Generate accounts for authorities to seal blocks
    for(let count = 1; count <= authorities; count++) {
      await executeCommand(`geth --datadir node${count} account new --password password.txt`)
      
      const files = fs.readdirSync(`node${count}/keystore/`);
      authorityAccounts.push('0x' + JSON.parse(fs.readFileSync(`node${count}/keystore/${files[0]}`, { encoding: 'utf8' })).address);      
    }

    //Generate genesis file
    let genesis = generateGenesis(blockTime, authorityAccounts, authorityAccounts);
    fs.writeFileSync('genesis.json', genesis, 'utf8');

    //Initialize the nodes with genesis file
    for(let count = 1; count <= totalNodes; count++) {
      await executeCommand(`geth --datadir node${count}/ init genesis.json`)
    }

    //Generate bootnode key
    await executeCommand(`bootnode -genkey boot.key`)

    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e)
  }
  
}

// Returns bootnode's key
let getBootnodePvtKey = _ => {
  const bootnodeKey = fs.readFileSync('boot.key');
  return bootnodeKey;
}

// Gets public key of any secp256k1 private key
let getPubKey = (pvtKey) => {
  const privateKeyBuffer = EthUtil.toBuffer('0x' + pvtKey);
  const wallet = Wallet.fromPrivateKey(privateKeyBuffer);
  return wallet.getPublicKeyString().slice(2);        
}

// Starts a initailized network
let startNetwork = (bootnodePubkey, authorities, peers) => {

  //Start bootnode
  startBGProcess('bootnode', ['-nodekey', 'boot.key', '-addr', ':30210'])

  let port = 30301;
  let rpcPort = 8545;
  let totalNodes = authorities + peers;

  //Start all the nodes
  for(let count = 1; count <= totalNodes; count++) {
    let args = [
      '--datadir',
      `node${count}/`,
      `--syncmode`,
      `full`,
      '--port',
      `${port}`,
      '--rpc',
      '--rpcaddr',
      `localhost`,
      '--rpcport',
      `${rpcPort}`,
      '--rpcapi',
      `personal,db,eth,net,web3,txpool,miner`,
      '--bootnodes',
      `enode://${bootnodePubkey}@127.0.0.1:30210`,
      '--networkid',
      '1515',
      '--gasprice',
      `1`,
      '--verbosity',
      '2'
    ]

    if(count <= authorities) {
      args = args.concat([
        '--unlock',
        '0',
        '--password',
        'password.txt',
        '--mine',
        '--allow-insecure-unlock'
      ])
    }

    startBGProcess('geth', args, `./node${count}/console.log`)

    count == 1 ? console.log(`Successfully started the network with ${authorities} authority and ${peers} peer nodes. Here are commands to connect to running nodes: \n`) : null;
    console.log(`Node ${count} (${count <= authorities ? 'Authority' : 'Peer'}): \n IPC Attach: geth attach ${outputDir}/node${count}/geth.ipc \n RPC Endpoint: localhost:${rpcPort}`)

    port++;
    rpcPort++;
  }
}

// Saves state so that restart can be supported.
let saveState = (authorities, peers) => {
  fs.writeFileSync('network-config.json', JSON.stringify({authorities, peers}), 'utf8');
}

// Reads the saved state
let readState = _ => {
  return JSON.parse(fs.readFileSync('network-config.json'));
}

const newNetworkQuestions = [
  {
    type : 'number',
    name : 'authorities',
    message : 'Enter total authority nodes ...',
    default: 2,
    validate: (authorities) => {
      if (authorities > 0) {
        return true;
      } else {
        return "Error: atleast 1 authority node is required"
      }
    }
  },
  {
    type : 'number',
    name : 'peers',
    message : 'Enter total peer nodes ...',
    default: 1,
    validate: (peers) => {
      if (peers < 0) {
        return "Error: peer count should be greater than equal to 0"
      } else {
        return true
      }
    }
  },
  {
    type : 'string',
    name : 'password',
    message : 'Enter password for ethereum accounts ...',
    default: 'Password@123'
  },
  {
    type : 'string',
    name : 'blockTime',
    message : 'Enter block time ...',
    default: 5,
    validate: (blockTime) => {
      if (blockTime > 0) {
        return true;
      } else {
        return "Error: should be more than 0"
      }
    }
  }
];

program.command('new').alias('n').description('Create new Network').action(() => {
  prompt(newNetworkQuestions).then(async answers => {
    
    resetNetwork();

    answers.authorities = parseInt(answers.authorities)
    answers.peers = parseInt(answers.peers)
    answers.blockTime = parseInt(answers.blockTime)

    await initNetwork(answers.authorities, answers.peers, answers.password, answers.blockTime)
    startNetwork(getPubKey(getBootnodePvtKey()), answers.authorities, answers.peers);
    saveState(answers.authorities, answers.peers);
  });
});

program .command('delete') .alias('d') .description('Delete Network').action(_ => {
  resetNetwork();
  console.log('Network deleted successfully.')
});

program .command('stop') .alias('s') .description('Stop Network').action(_ => {
  stopNetwork();
  console.log('Network stopped successfully.');
});

program .command('restart') .alias('r') .description('Restart Network').action(_ => {
  stopNetwork();
  let answers = readState();
  startNetwork(getPubKey(getBootnodePvtKey()), answers.authorities, answers.peers);

  console.log('Network restarted successfully');
});

program.parse(process.argv);